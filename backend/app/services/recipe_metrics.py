"""
Compute nutrition, cost, and CO2e for a recipe from the canonical taxonomy.

When ingredients have been resolved (ingredient_id set) and we can convert
their quantities to grams, the totals are pure SQL/Python — no LLM call.

If too many ingredients are unresolved or unit-converting fails, the caller
should fall back to the LLM-based estimator.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Ingredient as IngredientModel


# ─── Unit conversion helpers ────────────────────────────────────────────────

# Volume in millilitres
_VOLUME_ML: dict[str, float] = {
    "tsp": 4.92892, "teaspoon": 4.92892, "teaspoons": 4.92892,
    "tbsp": 14.7868, "tablespoon": 14.7868, "tablespoons": 14.7868,
    "fl oz": 29.5735, "fluid ounce": 29.5735, "fluid ounces": 29.5735,
    "cup": 236.588, "cups": 236.588,
    "pint": 473.176, "pints": 473.176,
    "quart": 946.353, "quarts": 946.353,
    "gallon": 3785.41, "gallons": 3785.41,
    "ml": 1.0, "milliliter": 1.0, "milliliters": 1.0,
    "millilitre": 1.0, "millilitres": 1.0,
    "l": 1000.0, "liter": 1000.0, "liters": 1000.0,
    "litre": 1000.0, "litres": 1000.0,
}

# Weight in grams
_WEIGHT_G: dict[str, float] = {
    "oz": 28.3495, "ounce": 28.3495, "ounces": 28.3495,
    "lb": 453.592, "lbs": 453.592, "pound": 453.592, "pounds": 453.592,
    "g": 1.0, "gram": 1.0, "grams": 1.0,
    "kg": 1000.0, "kilogram": 1000.0, "kilograms": 1000.0,
}


def to_grams(quantity: Optional[float], unit: Optional[str], canonical: IngredientModel) -> Optional[float]:
    """Convert a quantity+unit to grams using the canonical row's metadata.

    Returns None if conversion is not possible.
    """
    if quantity is None:
        return None
    u = (unit or "").lower().strip()

    # Direct weight
    if u in _WEIGHT_G:
        return quantity * _WEIGHT_G[u]

    # Volume needs density
    if u in _VOLUME_ML:
        if canonical.density_g_per_ml is None:
            # Fall back to water density (1.0). Better than nothing for liquids.
            density = 1.0
        else:
            density = float(canonical.density_g_per_ml)
        return quantity * _VOLUME_ML[u] * density

    # Unit-less quantity (e.g. "1 onion") — use typical_unit_weight_g
    if not u:
        if canonical.typical_unit_weight_g is not None:
            return quantity * float(canonical.typical_unit_weight_g)
        # Approximate small herb/spice quantities like "a pinch" defaulting
        # to nothing meaningful — return None so caller knows.
        return None

    return None


# ─── Aggregates ─────────────────────────────────────────────────────────────

@dataclass
class RecipeMetrics:
    servings: int
    resolved_count: int
    total_count: int
    # Per-serving nutrition
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    saturated_fat_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    sodium_mg: float = 0
    # Cost
    cost_total_gbp: float = 0
    cost_per_serving_gbp: float = 0
    # Impact
    kg_co2e_total: float = 0
    kg_co2e_per_serving: float = 0

    @property
    def resolution_rate(self) -> float:
        return self.resolved_count / self.total_count if self.total_count else 0.0


async def compute_metrics(
    db: AsyncSession,
    ingredients: list[dict],
    servings: int,
) -> RecipeMetrics:
    """Compute totals across the supplied recipe ingredients.

    Each ingredient dict should have at least: quantity, unit, item.
    If `ingredient_id` is set, we use it directly. Otherwise we attempt a
    last-resort exact lookup by canonical_name == item.
    """
    metrics = RecipeMetrics(
        servings=max(servings or 1, 1),
        resolved_count=0,
        total_count=len(ingredients),
    )

    # Pre-fetch all referenced canonical rows in one go
    ids = [i.get("ingredient_id") for i in ingredients if i.get("ingredient_id")]
    rows: dict[int, IngredientModel] = {}
    if ids:
        result = await db.execute(select(IngredientModel).where(IngredientModel.id.in_(ids)))
        for r in result.scalars():
            rows[r.id] = r

    for ing in ingredients:
        ingredient_id = ing.get("ingredient_id")
        canonical = rows.get(ingredient_id) if ingredient_id else None
        if not canonical:
            continue

        grams = to_grams(ing.get("quantity"), ing.get("unit"), canonical)
        if grams is None or grams <= 0:
            continue

        metrics.resolved_count += 1
        scale = grams / 100.0  # values are per 100g

        if canonical.per_100g_calories is not None:
            metrics.calories += float(canonical.per_100g_calories) * scale
        if canonical.per_100g_protein_g is not None:
            metrics.protein_g += float(canonical.per_100g_protein_g) * scale
        if canonical.per_100g_carbs_g is not None:
            metrics.carbs_g += float(canonical.per_100g_carbs_g) * scale
        if canonical.per_100g_fat_g is not None:
            metrics.fat_g += float(canonical.per_100g_fat_g) * scale
        if canonical.per_100g_saturated_fat_g is not None:
            metrics.saturated_fat_g += float(canonical.per_100g_saturated_fat_g) * scale
        if canonical.per_100g_fiber_g is not None:
            metrics.fiber_g += float(canonical.per_100g_fiber_g) * scale
        if canonical.per_100g_sugar_g is not None:
            metrics.sugar_g += float(canonical.per_100g_sugar_g) * scale
        if canonical.per_100g_sodium_mg is not None:
            metrics.sodium_mg += float(canonical.per_100g_sodium_mg) * scale

        # Cost: prefer per-unit when ingredient is unitless (e.g. eggs)
        if (not ing.get("unit")) and canonical.cost_per_unit_gbp is not None:
            metrics.cost_total_gbp += float(canonical.cost_per_unit_gbp) * (ing.get("quantity") or 0)
        elif canonical.cost_per_kg_gbp is not None:
            metrics.cost_total_gbp += float(canonical.cost_per_kg_gbp) * (grams / 1000.0)

        # Impact
        if canonical.kg_co2e_per_kg is not None:
            metrics.kg_co2e_total += float(canonical.kg_co2e_per_kg) * (grams / 1000.0)

    # Per serving = total / servings
    metrics.calories = metrics.calories / metrics.servings
    metrics.protein_g = metrics.protein_g / metrics.servings
    metrics.carbs_g = metrics.carbs_g / metrics.servings
    metrics.fat_g = metrics.fat_g / metrics.servings
    metrics.saturated_fat_g = metrics.saturated_fat_g / metrics.servings
    metrics.fiber_g = metrics.fiber_g / metrics.servings
    metrics.sugar_g = metrics.sugar_g / metrics.servings
    metrics.sodium_mg = metrics.sodium_mg / metrics.servings
    metrics.cost_per_serving_gbp = metrics.cost_total_gbp / metrics.servings
    metrics.kg_co2e_per_serving = metrics.kg_co2e_total / metrics.servings

    return metrics


def impact_rating(kg_co2e_per_serving: float) -> str:
    if kg_co2e_per_serving < 1.0:
        return "low"
    if kg_co2e_per_serving < 4.0:
        return "medium"
    return "high"
