"""
One-shot backfill of ingredient_id on existing recipes.

Designed to be safe to call on every startup: it only touches ingredients
that don't already have an ingredient_id, so once a row is stamped it's
skipped on every subsequent run. Tolerates resolver failures (skips, logs)
without aborting the rest of the work.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Recipe
from app.services.ingredient_resolver import resolve as resolve_ingredient


async def backfill_all_recipes(db: AsyncSession, allow_llm: bool = True) -> dict:
    """Stamp ingredient_id onto every recipe ingredient that doesn't have one.

    Returns counts: {recipes_processed, recipes_changed, ingredients_resolved}.
    """
    result = await db.execute(select(Recipe))
    recipes = list(result.scalars())

    recipes_changed = 0
    ingredients_resolved = 0

    for r in recipes:
        ings = list(r.ingredients or [])
        if not ings:
            continue
        needs_work = any(not ing.get("ingredient_id") for ing in ings if isinstance(ing, dict))
        if not needs_work:
            continue

        changed = False
        for ing in ings:
            if not isinstance(ing, dict):
                continue
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
                ingredients_resolved += 1

        # Also resolve the working_state's ingredients if present
        ws = r.working_state
        if isinstance(ws, dict) and isinstance(ws.get("ingredients"), list):
            ws_ings = ws["ingredients"]
            ws_changed = False
            for ing in ws_ings:
                if not isinstance(ing, dict) or ing.get("ingredient_id"):
                    continue
                item = ing.get("item") or ""
                if not item.strip():
                    continue
                try:
                    canonical = await resolve_ingredient(db, item, allow_llm=allow_llm)
                except Exception as e:
                    print(f"Backfill resolver failed for working-state '{item}': {e}")
                    continue
                if canonical:
                    ing["ingredient_id"] = canonical.id
                    ws_changed = True
                    ingredients_resolved += 1
            if ws_changed:
                ws["ingredients"] = ws_ings
                r.working_state = dict(ws)
                changed = True

        if changed:
            r.ingredients = ings
            recipes_changed += 1
            try:
                await db.commit()
            except Exception as e:
                print(f"Backfill commit failed for recipe {r.id}: {e}")
                await db.rollback()

    return {
        "recipes_processed": len(recipes),
        "recipes_changed": recipes_changed,
        "ingredients_resolved": ingredients_resolved,
    }
