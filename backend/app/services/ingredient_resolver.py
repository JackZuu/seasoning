"""
Ingredient resolver: matches a recipe ingredient string to a row in the
canonical taxonomy. Three stages, escalating from cheap to LLM.

  1. Exact match on canonical_name, display_name, or synonyms
  2. Fuzzy match (trigram on Postgres, sequence similarity in Python on SQLite)
  3. LLM fallback that classifies as synonym / variant / new and writes a row

Stage 3 happens at most once per new ingredient. After the row exists,
future recipes match in stage 1.
"""
from __future__ import annotations

import asyncio
import json
import re
from difflib import SequenceMatcher
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Ingredient
from app.openai_module import chat_completion
from app.prompts.ingredient_resolve import INGREDIENT_RESOLVE_SYSTEM_PROMPT


# ─── Normalisation ──────────────────────────────────────────────────────────

_NOISE_WORDS = {
    "fresh", "dried", "chopped", "diced", "minced", "sliced", "grated",
    "ground", "crushed", "whole", "cooked", "raw", "frozen", "tinned", "canned",
    "large", "medium", "small", "ripe", "good quality", "free range",
    "organic", "extra", "fine", "coarse",
}


def normalise(s: str) -> str:
    """Lowercase, strip noise words and qualifiers from an ingredient string."""
    s = (s or "").lower().strip()
    s = re.sub(r"[(),].*", "", s)               # drop trailing notes in brackets/commas
    s = re.sub(r"\s+", " ", s)
    tokens = [t for t in s.split() if t not in _NOISE_WORDS]
    return " ".join(tokens).strip()


# ─── Stage 1: exact match ────────────────────────────────────────────────────

async def find_exact(db: AsyncSession, item: str) -> Optional[Ingredient]:
    norm = normalise(item)
    if not norm:
        return None
    # canonical_name or display_name match
    result = await db.execute(
        select(Ingredient).where(
            (Ingredient.canonical_name == norm) |
            (Ingredient.display_name.ilike(norm))
        )
    )
    row = result.scalar_one_or_none()
    if row:
        return row

    # Synonym match: scan synonym arrays. JSON column varies between SQLite
    # and Postgres so we just pull all rows and match in Python (cheap when
    # the taxonomy is in the low thousands).
    all_rows = await db.execute(select(Ingredient))
    for ing in all_rows.scalars():
        synonyms = ing.synonyms or []
        for syn in synonyms:
            if syn.lower() == norm:
                return ing
    return None


# ─── Stage 2: fuzzy match ────────────────────────────────────────────────────

async def find_fuzzy(db: AsyncSession, item: str, threshold: float = 0.55) -> Optional[Ingredient]:
    """Return the best-matching row above the similarity threshold, else None.

    Uses pg_trgm on Postgres for speed, Python's SequenceMatcher elsewhere.
    """
    norm = normalise(item)
    if not norm:
        return None

    is_postgres = "postgresql" in str(db.bind.engine.url) if db.bind else False
    if is_postgres:
        try:
            result = await db.execute(
                text(
                    "SELECT id, similarity(canonical_name, :q) AS sim "
                    "FROM ingredient "
                    "WHERE canonical_name % :q "
                    "ORDER BY sim DESC LIMIT 1"
                ),
                {"q": norm},
            )
            row = result.first()
            if row and row.sim >= threshold:
                return await db.get(Ingredient, row.id)
            return None
        except Exception:
            # pg_trgm may not be enabled; fall through to Python
            pass

    # Python fallback
    all_rows = await db.execute(select(Ingredient))
    best: tuple[float, Optional[Ingredient]] = (0.0, None)
    for ing in all_rows.scalars():
        candidates = [ing.canonical_name] + [s.lower() for s in (ing.synonyms or [])]
        for cand in candidates:
            sim = SequenceMatcher(None, norm, cand).ratio()
            if sim > best[0]:
                best = (sim, ing)
    if best[0] >= threshold:
        return best[1]
    return None


# ─── Stage 3: LLM classification ─────────────────────────────────────────────

async def find_or_create_with_llm(
    db: AsyncSession,
    item: str,
    fuzzy_candidates: list[Ingredient],
) -> Optional[Ingredient]:
    """Ask the LLM to classify the ingredient, then either link or create.

    Returns the resolved Ingredient row, or None if the LLM declined.
    """
    norm = normalise(item)
    if not norm:
        return None

    candidates_summary = [
        {
            "canonical_name": c.canonical_name,
            "category": c.category,
            "synonyms": c.synonyms or [],
        }
        for c in fuzzy_candidates[:5]
    ]

    user_msg = (
        f"Ingredient to classify: {item}\n"
        f"Closest existing rows: {json.dumps(candidates_summary)}"
    )

    def _do_classify():
        result = chat_completion(
            messages=[
                {"role": "system", "content": INGREDIENT_RESOLVE_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            model="gpt-4o-mini",
            temperature=0.1,
        )
        if "error" in result and "content" not in result:
            return None
        content = result.get("content", "")
        # Strip markdown fences if present
        if "```json" in content:
            start = content.find("```json") + 7
            end = content.find("```", start)
            content = content[start:end]
        elif "```" in content:
            start = content.find("```") + 3
            end = content.find("```", start)
            content = content[start:end]
        first = content.find("{"); last = content.rfind("}")
        if first != -1 and last != -1:
            content = content[first : last + 1]
        try:
            return json.loads(content)
        except Exception:
            return None

    try:
        data = await asyncio.to_thread(_do_classify)
    except Exception:
        return None
    if not data or not isinstance(data, dict):
        return None

    decision = (data.get("decision") or "").lower()

    if decision == "synonym":
        target = data.get("target_canonical_name", "").lower().strip()
        if not target:
            return None
        existing = await db.execute(
            select(Ingredient).where(Ingredient.canonical_name == target)
        )
        row = existing.scalar_one_or_none()
        if not row:
            return None
        # Append synonym so future lookups hit stage 1
        synonyms = list(row.synonyms or [])
        if norm not in synonyms:
            synonyms.append(norm)
            row.synonyms = synonyms
            await db.commit()
            await db.refresh(row)
        return row

    if decision in ("variant", "new"):
        canonical_name = (data.get("canonical_name") or norm).lower().strip()
        if not canonical_name:
            return None
        # Avoid duplicate insertion if the LLM returns an existing name
        existing = await db.execute(
            select(Ingredient).where(Ingredient.canonical_name == canonical_name)
        )
        existing_row = existing.scalar_one_or_none()
        if existing_row:
            return existing_row

        parent_id = None
        parent_name = data.get("parent_canonical_name")
        if decision == "variant" and parent_name:
            parent_q = await db.execute(
                select(Ingredient).where(Ingredient.canonical_name == parent_name.lower().strip())
            )
            parent_row = parent_q.scalar_one_or_none()
            if parent_row:
                parent_id = parent_row.id

        nutrition = data.get("nutrition_per_100g") or {}
        cost = data.get("cost") or {}
        impact = data.get("impact") or {}
        flags = data.get("flags") or {}

        row = Ingredient(
            canonical_name=canonical_name,
            display_name=data.get("display_name") or canonical_name.title(),
            parent_id=parent_id,
            category=data.get("category"),
            synonyms=[s.lower() for s in (data.get("synonyms") or []) if isinstance(s, str)],
            density_g_per_ml=data.get("density_g_per_ml"),
            typical_unit_weight_g=data.get("typical_unit_weight_g"),
            typical_unit_label=data.get("typical_unit_label"),
            per_100g_calories=nutrition.get("calories"),
            per_100g_protein_g=nutrition.get("protein_g"),
            per_100g_carbs_g=nutrition.get("carbs_g"),
            per_100g_fat_g=nutrition.get("fat_g"),
            per_100g_saturated_fat_g=nutrition.get("saturated_fat_g"),
            per_100g_fiber_g=nutrition.get("fiber_g"),
            per_100g_sugar_g=nutrition.get("sugar_g"),
            per_100g_sodium_mg=nutrition.get("sodium_mg"),
            cost_per_kg_gbp=cost.get("per_kg_gbp"),
            cost_per_unit_gbp=cost.get("per_unit_gbp"),
            kg_co2e_per_kg=impact.get("kg_co2e_per_kg"),
            is_vegetarian=flags.get("is_vegetarian", True),
            is_vegan=flags.get("is_vegan", True),
            contains_gluten=flags.get("contains_gluten", False),
            contains_dairy=flags.get("contains_dairy", False),
            contains_nuts=flags.get("contains_nuts", False),
            contains_egg=flags.get("contains_egg", False),
            contains_soy=flags.get("contains_soy", False),
            contains_shellfish=flags.get("contains_shellfish", False),
            source="openai",
            data_quality="ai_generated",
        )
        db.add(row)
        await db.commit()
        await db.refresh(row)
        return row

    return None


# ─── Top-level entry point ───────────────────────────────────────────────────

async def resolve(db: AsyncSession, item: str, allow_llm: bool = True) -> Optional[Ingredient]:
    """Resolve a parsed ingredient item to a canonical row.

    Cascades through exact → fuzzy → LLM. Set allow_llm=False for batch
    backfills where you want to avoid burning tokens.
    """
    if not item or not item.strip():
        return None

    hit = await find_exact(db, item)
    if hit:
        return hit

    fuzzy = await find_fuzzy(db, item, threshold=0.7)
    if fuzzy:
        return fuzzy

    if not allow_llm:
        return None

    # Provide top fuzzy candidates to the LLM as context
    norm = normalise(item)
    all_rows = await db.execute(select(Ingredient))
    candidates: list[tuple[float, Ingredient]] = []
    for ing in all_rows.scalars():
        sim = SequenceMatcher(None, norm, ing.canonical_name).ratio()
        candidates.append((sim, ing))
    candidates.sort(key=lambda x: -x[0])
    top = [c[1] for c in candidates[:5]]

    return await find_or_create_with_llm(db, item, top)
