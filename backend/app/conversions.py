"""
Unit conversion lookup table.
All conversions are pure arithmetic — no OpenAI calls.
Add new unit mappings here to extend coverage.
"""
from typing import Optional

# ─── Lookup tables ────────────────────────────────────────────────────────────

# All volume units expressed in millilitres
VOLUME_ML: dict[str, float] = {
    "tsp": 4.92892,
    "teaspoon": 4.92892,
    "teaspoons": 4.92892,
    "tbsp": 14.7868,
    "tablespoon": 14.7868,
    "tablespoons": 14.7868,
    "fl oz": 29.5735,
    "fluid ounce": 29.5735,
    "fluid ounces": 29.5735,
    "cup": 236.588,
    "cups": 236.588,
    "pint": 473.176,
    "pints": 473.176,
    "quart": 946.353,
    "quarts": 946.353,
    "gallon": 3785.41,
    "gallons": 3785.41,
    "ml": 1.0,
    "milliliter": 1.0,
    "milliliters": 1.0,
    "millilitre": 1.0,
    "millilitres": 1.0,
    "l": 1000.0,
    "liter": 1000.0,
    "liters": 1000.0,
    "litre": 1000.0,
    "litres": 1000.0,
}

# All weight units expressed in grams
WEIGHT_G: dict[str, float] = {
    "oz": 28.3495,
    "ounce": 28.3495,
    "ounces": 28.3495,
    "lb": 453.592,
    "lbs": 453.592,
    "pound": 453.592,
    "pounds": 453.592,
    "g": 1.0,
    "gram": 1.0,
    "grams": 1.0,
    "kg": 1000.0,
    "kilogram": 1000.0,
    "kilograms": 1000.0,
}


# ─── Core conversion logic ────────────────────────────────────────────────────

def _pick_volume_us(ml: float) -> tuple[float, str]:
    """Convert ml to the most readable US volume unit."""
    cups = ml / VOLUME_ML["cup"]
    if cups >= 0.25:
        return round(cups * 4) / 4, "cup"  # round to nearest 1/4 cup
    tbsp = ml / VOLUME_ML["tbsp"]
    if tbsp >= 1:
        return round(tbsp, 1), "tbsp"
    tsp = ml / VOLUME_ML["tsp"]
    return round(tsp, 1), "tsp"


def _pick_volume_metric(ml: float) -> tuple[float, str]:
    """Convert ml to the most readable metric volume unit."""
    if ml >= 1000:
        return round(ml / 1000, 2), "l"
    return round(ml, 0), "ml"


def _pick_weight_us(grams: float) -> tuple[float, str]:
    """Convert grams to the most readable US weight unit."""
    oz = grams / WEIGHT_G["oz"]
    if oz >= 16:
        return round(oz / 16, 2), "lb"
    return round(oz, 1), "oz"


def _pick_weight_metric(grams: float) -> tuple[float, str]:
    """Convert grams to the most readable metric weight unit."""
    if grams >= 1000:
        return round(grams / 1000, 2), "kg"
    return round(grams, 0), "g"


def _convert_one(ing: dict, target_system: str) -> dict:
    unit = (ing.get("unit") or "").lower().strip()
    quantity = ing.get("quantity")

    # Nothing to do
    if not unit or quantity is None:
        return {**ing}

    if unit in VOLUME_ML:
        ml = quantity * VOLUME_ML[unit]
        if target_system == "metric":
            qty, u = _pick_volume_metric(ml)
        else:
            qty, u = _pick_volume_us(ml)
        return {**ing, "quantity": qty, "unit": u, "unit_system": target_system}

    if unit in WEIGHT_G:
        grams = quantity * WEIGHT_G[unit]
        if target_system == "metric":
            qty, u = _pick_weight_metric(grams)
        else:
            qty, u = _pick_weight_us(grams)
        return {**ing, "quantity": qty, "unit": u, "unit_system": target_system}

    # Unknown unit — return unchanged
    return {**ing}


def convert_ingredients(ingredients: list[dict], target_system: str) -> list[dict]:
    """
    Convert a list of ingredient dicts to the target unit system.
    Unknown units are passed through unchanged.
    Modular: extend VOLUME_ML / WEIGHT_G to support more units.
    """
    return [_convert_one(ing, target_system) for ing in ingredients]
