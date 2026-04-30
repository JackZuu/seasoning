"""
Idempotent seeder for the ingredient taxonomy.

Run on app startup: if the ingredient table is empty, populate it from the
curated seed file. If rows already exist, do nothing. New entries can be
added to ingredient_seed.py and re-running the seeder will only insert
canonical_names that are not already present.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Ingredient
from app.data.ingredient_seed import INGREDIENTS


async def seed_ingredients(db: AsyncSession) -> int:
    """Insert any seed rows whose canonical_name is not yet in the database.

    Returns the number of rows inserted. Resolves `parent` (string canonical
    name) into `parent_id` after the parent row exists.
    """
    existing = await db.execute(select(Ingredient.canonical_name))
    existing_names = {row[0] for row in existing.all()}

    # First pass: insert rows that have no parent (or whose parent is also new)
    # We do two passes so children can resolve parent_id.
    name_to_id: dict[str, int] = {}
    inserted = 0

    # Pass 1: insert rows without a parent OR with a parent already present
    for entry in INGREDIENTS:
        name = entry["canonical_name"]
        if name in existing_names:
            continue
        parent_name = entry.get("parent")
        if parent_name and parent_name not in existing_names and parent_name not in name_to_id:
            continue  # defer to pass 2
        row = _build_row(entry, name_to_id)
        db.add(row)
        await db.flush()
        name_to_id[name] = row.id
        inserted += 1

    # Pass 2: anything left whose parent is now in the DB (or was inserted in pass 1)
    for entry in INGREDIENTS:
        name = entry["canonical_name"]
        if name in existing_names or name in name_to_id:
            continue
        row = _build_row(entry, name_to_id)
        db.add(row)
        await db.flush()
        name_to_id[name] = row.id
        inserted += 1

    if inserted:
        await db.commit()
        print(f"Ingredient seeder: inserted {inserted} rows.")
    return inserted


def _build_row(entry: dict, name_to_id: dict[str, int]) -> Ingredient:
    """Build an Ingredient ORM object from a seed dict, resolving parent string -> id."""
    parent_name = entry.get("parent")
    parent_id = None
    if parent_name:
        parent_id = name_to_id.get(parent_name)
        # If still None, parent must exist in DB already; resolver fills later.

    synonyms = [s.lower() for s in entry.get("synonyms", []) or []]

    return Ingredient(
        canonical_name=entry["canonical_name"],
        display_name=entry.get("display_name"),
        parent_id=parent_id,
        category=entry.get("category"),
        synonyms=synonyms,
        density_g_per_ml=entry.get("density_g_per_ml"),
        typical_unit_weight_g=entry.get("typical_unit_weight_g"),
        typical_unit_label=entry.get("typical_unit_label"),
        per_100g_calories=entry.get("per_100g_calories"),
        per_100g_protein_g=entry.get("per_100g_protein_g"),
        per_100g_carbs_g=entry.get("per_100g_carbs_g"),
        per_100g_fat_g=entry.get("per_100g_fat_g"),
        per_100g_saturated_fat_g=entry.get("per_100g_saturated_fat_g"),
        per_100g_fiber_g=entry.get("per_100g_fiber_g"),
        per_100g_sugar_g=entry.get("per_100g_sugar_g"),
        per_100g_sodium_mg=entry.get("per_100g_sodium_mg"),
        cost_per_kg_gbp=entry.get("cost_per_kg_gbp"),
        cost_per_unit_gbp=entry.get("cost_per_unit_gbp"),
        kg_co2e_per_kg=entry.get("kg_co2e_per_kg"),
        is_vegetarian=entry.get("is_vegetarian", True),
        is_vegan=entry.get("is_vegan", True),
        contains_gluten=entry.get("contains_gluten", False),
        contains_dairy=entry.get("contains_dairy", False),
        contains_nuts=entry.get("contains_nuts", False),
        contains_egg=entry.get("contains_egg", False),
        contains_soy=entry.get("contains_soy", False),
        contains_shellfish=entry.get("contains_shellfish", False),
        source=entry.get("source", "seed"),
        data_quality=entry.get("data_quality", "verified"),
    )
