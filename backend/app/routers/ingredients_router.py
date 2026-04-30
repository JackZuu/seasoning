"""
Ingredient taxonomy endpoints: autocomplete + backfill.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.models import User, Recipe, Ingredient as IngredientModel
from app.auth import get_current_user
from app.services.ingredient_resolver import resolve as resolve_ingredient, normalise


router = APIRouter(prefix="/api/ingredients", tags=["ingredients"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class IngredientHit(BaseModel):
    id: int
    canonical_name: str
    display_name: Optional[str] = None
    category: Optional[str] = None
    typical_unit_label: Optional[str] = None


class BackfillResponse(BaseModel):
    recipes_processed: int
    ingredients_resolved: int
    new_ingredients_created: int


# ─── Autocomplete ───────────────────────────────────────────────────────────

@router.get("/search", response_model=list[IngredientHit])
async def search_ingredients(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Prefix + fuzzy match against canonical_name, display_name, synonyms."""
    norm = normalise(q)
    if not norm:
        return []

    # Prefix match first (cheap, ranks naturally on Postgres + SQLite)
    prefix_q = await db.execute(
        select(IngredientModel)
        .where(IngredientModel.canonical_name.ilike(f"{norm}%"))
        .order_by(IngredientModel.canonical_name)
        .limit(10)
    )
    prefix_hits = list(prefix_q.scalars())
    seen_ids = {h.id for h in prefix_hits}

    # Substring on display_name + synonyms (Python scan; cheap at small N)
    if len(prefix_hits) < 10:
        all_q = await db.execute(select(IngredientModel))
        for ing in all_q.scalars():
            if ing.id in seen_ids:
                continue
            haystacks = [(ing.display_name or "").lower()] + [s.lower() for s in (ing.synonyms or [])]
            if any(norm in h for h in haystacks if h):
                prefix_hits.append(ing)
                seen_ids.add(ing.id)
            if len(prefix_hits) >= 10:
                break

    return [
        IngredientHit(
            id=ing.id,
            canonical_name=ing.canonical_name,
            display_name=ing.display_name,
            category=ing.category,
            typical_unit_label=ing.typical_unit_label,
        )
        for ing in prefix_hits[:10]
    ]


# ─── Resolve a single string (manual swap / edit) ───────────────────────────

class ResolveRequest(BaseModel):
    item: str
    allow_llm: bool = True


@router.post("/resolve", response_model=Optional[IngredientHit])
async def resolve_one(
    req: ResolveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    canonical = await resolve_ingredient(db, req.item, allow_llm=req.allow_llm)
    if not canonical:
        return None
    return IngredientHit(
        id=canonical.id,
        canonical_name=canonical.canonical_name,
        display_name=canonical.display_name,
        category=canonical.category,
        typical_unit_label=canonical.typical_unit_label,
    )


# ─── Backfill (admin-ish, but auth-gated to logged-in user's own recipes) ──

@router.post("/backfill", response_model=BackfillResponse)
async def backfill_user_recipes(
    allow_llm: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run the resolver against every ingredient in the current user's
    recipes, writing back ingredient_id where a match is found.

    By default, allow_llm=False keeps this cheap (only exact + fuzzy match).
    Set allow_llm=true to also classify unknowns via the LLM.
    """
    result = await db.execute(select(Recipe).where(Recipe.user_id == current_user.id))
    recipes = list(result.scalars())
    rows_resolved = 0
    new_created_baseline = await db.execute(text("SELECT COUNT(*) FROM ingredient"))
    before_count = new_created_baseline.scalar() or 0

    for r in recipes:
        ings = list(r.ingredients or [])
        changed = False
        for ing in ings:
            if ing.get("ingredient_id"):
                continue
            item = ing.get("item") or ""
            if not item.strip():
                continue
            try:
                canonical = await resolve_ingredient(db, item, allow_llm=allow_llm)
            except Exception as e:
                print(f"Backfill resolver failed for '{item}': {e}")
                continue
            if canonical:
                ing["ingredient_id"] = canonical.id
                changed = True
                rows_resolved += 1
        if changed:
            r.ingredients = ings
            await db.commit()

    after_q = await db.execute(text("SELECT COUNT(*) FROM ingredient"))
    after_count = after_q.scalar() or 0

    return BackfillResponse(
        recipes_processed=len(recipes),
        ingredients_resolved=rows_resolved,
        new_ingredients_created=max(0, after_count - before_count),
    )
