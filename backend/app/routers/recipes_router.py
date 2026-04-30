import asyncio
import base64
import json
import re
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import ValidationError

from app.database import get_db
from app.models import Recipe
from app.schemas import (
    RecipeParseRequest, RecipeCreate, RecipeResponse, RecipeListItem,
    ConvertRequest, ConvertResponse, Ingredient, InstructionStep,
    RecipeURLParseRequest, RecipeGenerateRequest, RecipeUpdateNotes,
    TransformRequest, TransformResponse,
    SubstitutionRequest, SubstitutionResponse, SubstitutionOption,
    NutritionResponse, NutritionPerServing,
    CostResponse, ImpactResponse,
    WorkingStatePut, RecipeAnalysisRequest,
)
from app.auth import get_current_user
from app.models import User, Friendship
from app.openai_module import chat_completion, vision_completion
from app.prompts import (
    RECIPE_PARSE_SYSTEM_PROMPT, RECIPE_IMAGE_SYSTEM_PROMPT,
    RECIPE_TRANSFORM_SYSTEM_PROMPT, INGREDIENT_SUBSTITUTE_SYSTEM_PROMPT,
    NUTRITION_SYSTEM_PROMPT, COST_ESTIMATE_SYSTEM_PROMPT,
    IMPACT_ESTIMATE_SYSTEM_PROMPT,
    RECIPE_GENERATE_SYSTEM_PROMPT,
)
from app.conversions import convert_ingredients
from app.scraper import scrape_recipe_url
from app.services.ingredient_resolver import resolve as resolve_ingredient
from app.services.recipe_metrics import compute_metrics, impact_rating

router = APIRouter(prefix="/api/recipes", tags=["recipes"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
MAX_IMAGES = 5
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_json(content: str) -> dict:
    """Extract a JSON object from an LLM response, stripping markdown fences."""
    if "```json" in content:
        start = content.find("```json") + 7
        end = content.find("```", start)
        content = content[start:end].strip()
    elif "```" in content:
        start = content.find("```") + 3
        end = content.find("```", start)
        content = content[start:end].strip()

    first = content.find("{")
    last = content.rfind("}")
    if first != -1 and last != -1:
        content = content[first : last + 1]

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        raise ValueError(f"AI returned invalid JSON: {e}")

    if not isinstance(data, dict):
        raise ValueError("AI returned JSON but not an object")

    if "error" in data:
        raise ValueError(data["error"])

    return data


def _parse_recipe_text(raw_text: str) -> dict:
    result = chat_completion(
        messages=[
            {"role": "system", "content": RECIPE_PARSE_SYSTEM_PROMPT},
            {"role": "user", "content": raw_text},
        ],
        model="gpt-4o-mini",
        temperature=0.2,
    )
    if "error" in result and "content" not in result:
        raise ValueError(result["error"])
    return _extract_json(result.get("content", ""))


def _orm_to_response(recipe: Recipe) -> RecipeResponse:
    # Apply ingredient normalisation at read-time so older records (parsed
    # before the leading-number fix) display correctly without a migration.
    ings = _normalise_ingredients(list(recipe.ingredients or []))
    ws = None
    if recipe.working_state:
        ws_data = dict(recipe.working_state)
        if isinstance(ws_data.get("ingredients"), list):
            ws_data["ingredients"] = _normalise_ingredients(ws_data["ingredients"])
        ws = ws_data
    return RecipeResponse(
        id=recipe.id,
        user_id=recipe.user_id,
        title=recipe.title,
        servings=recipe.servings,
        ingredients=[Ingredient(**i) for i in ings],
        instructions=[InstructionStep(**s) for s in (recipe.instructions or [])],
        image_url=recipe.image_url,
        notes=recipe.notes or "",
        working_state=ws,
        created_at=recipe.created_at,
    )


# ─── Quantity normalisation for parsed ingredients ──────────────────────────
# The LLM occasionally leaves a leading number/fraction in `item` and a null
# `quantity`, which renders as a blank amount. Pull the leading numeric out.

_UNICODE_FRAC = {
    "½": 0.5, "⅓": 1/3, "⅔": 2/3, "¼": 0.25, "¾": 0.75,
    "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
    "⅙": 1/6, "⅚": 5/6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
}

def _try_parse_qty(token: str) -> float | None:
    token = token.strip()
    if not token:
        return None
    if token in _UNICODE_FRAC:
        return _UNICODE_FRAC[token]
    # "1/2"
    m = re.fullmatch(r"(\d+)\s*/\s*(\d+)", token)
    if m and int(m.group(2)) != 0:
        return int(m.group(1)) / int(m.group(2))
    # "1 1/2"
    m = re.fullmatch(r"(\d+)\s+(\d+)\s*/\s*(\d+)", token)
    if m and int(m.group(3)) != 0:
        return int(m.group(1)) + int(m.group(2)) / int(m.group(3))
    # "1 ½"
    m = re.fullmatch(rf"(\d+)\s+([{''.join(_UNICODE_FRAC.keys())}])", token)
    if m:
        return int(m.group(1)) + _UNICODE_FRAC[m.group(2)]
    try:
        return float(token)
    except ValueError:
        return None


# Common units recognised when squashed against the number ("200g", "1tsp")
_KNOWN_UNITS = {"g", "kg", "ml", "l", "tsp", "tbsp", "cup", "cups", "oz", "lb", "lbs"}


def _normalise_ingredients(ings: list[dict]) -> list[dict]:
    """If quantity is null but item starts with a number/fraction, lift it out.

    Also handles unit stuck to the number (e.g. "200g flour" -> qty=200, unit=g, item=flour).
    """
    pattern = re.compile(
        rf"^\s*((?:\d+\s+\d+\s*/\s*\d+)|(?:\d+\s*/\s*\d+)|(?:\d+\s+[{''.join(_UNICODE_FRAC.keys())}])|"
        rf"[{''.join(_UNICODE_FRAC.keys())}]|\d+(?:\.\d+)?)\s*(.*)$"
    )
    # Squashed "200g flour" — number directly followed by a unit
    squashed = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\s+(.+)$")

    out = []
    for ing in ings:
        if not isinstance(ing, dict):
            continue
        ing = dict(ing)
        # Coerce string quantities ("½", "1/2") to floats
        q = ing.get("quantity")
        if isinstance(q, str):
            parsed = _try_parse_qty(q)
            ing["quantity"] = parsed
            q = parsed
        # If quantity is still missing, try the item field
        if q is None:
            item = ing.get("item") or ""
            # Try squashed-unit pattern first ("200g tofu cubes")
            sm = squashed.match(item)
            if sm and sm.group(2).lower() in _KNOWN_UNITS:
                try:
                    qty_val = float(sm.group(1))
                except ValueError:
                    qty_val = None
                if qty_val is not None:
                    ing["quantity"] = qty_val
                    if not ing.get("unit"):
                        ing["unit"] = sm.group(2).lower()
                    ing["item"] = sm.group(3).strip()
                    out.append(ing)
                    continue
            m = pattern.match(item)
            if m:
                parsed = _try_parse_qty(m.group(1))
                if parsed is not None:
                    rest = m.group(2).strip()
                    if rest:
                        ing["quantity"] = parsed
                        ing["item"] = rest
        out.append(ing)
    return out


def _assert_ownership(recipe: Recipe | None, user_id: int):
    if not recipe or recipe.user_id != user_id:
        raise HTTPException(status_code=404, detail="Recipe not found")


async def _resolve_recipe_ingredients(
    db: AsyncSession,
    ingredients: list[dict],
    allow_llm: bool = True,
) -> list[dict]:
    """Run the resolver on each ingredient dict, returning new dicts with
    `ingredient_id` populated where a canonical match was found.
    """
    resolved: list[dict] = []
    for ing in ingredients:
        ing = dict(ing)
        if ing.get("ingredient_id"):
            resolved.append(ing)
            continue
        item = ing.get("item") or ""
        if not item.strip():
            resolved.append(ing)
            continue
        try:
            canonical = await resolve_ingredient(db, item, allow_llm=allow_llm)
            if canonical:
                ing["ingredient_id"] = canonical.id
        except Exception as e:
            print(f"Resolver failed for '{item}': {e}")
        resolved.append(ing)
    return resolved


def _estimate_servings_from_ingredients(ingredients: list[dict]) -> int:
    """Cheap, deterministic servings estimate based on staple quantities.

    Used only when the LLM fails to return a servings count. Looks at common
    staples (pasta, rice, meat, eggs, flour) and infers a sensible default.
    Falls back to 4 if nothing matches.
    """
    if not ingredients:
        return 4
    # Map of (item-substrings, weight-grams-per-serving) for staples
    staple_grams = [
        (("pasta", "spaghetti", "penne", "fusilli", "rigatoni", "tagliatelle", "linguine", "noodle"), 100),
        (("rice", "quinoa", "couscous"), 75),
        (("flour",), 80),
    ]
    meat_grams = (("chicken", "beef", "pork", "lamb", "salmon", "cod", "tuna", "prawn", "tofu", "halloumi"), 150)

    for ing in ingredients:
        item = (ing.get("item") or "").lower()
        qty = ing.get("quantity")
        unit = (ing.get("unit") or "").lower()
        if not isinstance(qty, (int, float)) or qty <= 0:
            continue
        # Convert to grams roughly
        grams = None
        if unit == "g":
            grams = qty
        elif unit == "kg":
            grams = qty * 1000
        elif not unit:
            # Discrete count, only useful for eggs
            if "egg" in item:
                return max(2, int(qty // 2))
            continue
        if grams is None:
            continue
        for keys, per_serving in staple_grams:
            if any(k in item for k in keys):
                return max(1, round(grams / per_serving))
        keys, per_serving = meat_grams
        if any(k in item for k in keys):
            return max(1, round(grams / per_serving))
    return 4


async def _save_recipe(data: dict, user_id: int, db: AsyncSession, image_url: str | None = None) -> Recipe:
    if isinstance(data, dict) and isinstance(data.get("ingredients"), list):
        data["ingredients"] = _normalise_ingredients(data["ingredients"])
    # Fallback servings if the LLM left it null
    if data.get("servings") in (None, 0):
        data["servings"] = _estimate_servings_from_ingredients(data.get("ingredients") or [])
    try:
        recipe_data = RecipeCreate(**data)
    except (ValidationError, Exception) as e:
        raise HTTPException(status_code=422, detail=f"Recipe format invalid: {str(e)}")

    raw_ings = [ing.model_dump() for ing in recipe_data.ingredients]
    resolved_ings = await _resolve_recipe_ingredients(db, raw_ings, allow_llm=True)

    recipe = Recipe(
        user_id=user_id,
        title=recipe_data.title,
        servings=recipe_data.servings,
        ingredients=resolved_ings,
        instructions=[step.model_dump() for step in recipe_data.instructions],
        image_url=image_url or recipe_data.image_url,
    )
    db.add(recipe)
    await db.commit()
    await db.refresh(recipe)
    return recipe


def _recipe_to_text(
    recipe: Recipe,
    ingredients: list | None = None,
    instructions: list | None = None,
    servings: int | None = None,
) -> str:
    """Convert a recipe to a text summary for AI context.

    Pass overrides to compute against a transformed/working state instead of
    the saved original.
    """
    ings = ingredients if ingredients is not None else (recipe.ingredients or [])
    insts = instructions if instructions is not None else (recipe.instructions or [])
    serves = servings if servings is not None else recipe.servings
    lines = [f"Title: {recipe.title}", f"Servings: {serves or 'unknown'}"]
    lines.append("\nIngredients:")
    for ing in ings:
        if hasattr(ing, "model_dump"):
            ing = ing.model_dump()
        qty = ing.get("quantity", "")
        unit = ing.get("unit", "") or ""
        item = ing.get("item", "")
        prep = ing.get("preparation", "")
        line = f"- {qty if qty is not None else ''} {unit} {item}".strip()
        if prep:
            line += f", {prep}"
        lines.append(line)
    lines.append("\nInstructions:")
    for step in insts:
        if hasattr(step, "model_dump"):
            step = step.model_dump()
        lines.append(f"{step.get('step', '')}. {step.get('text', '')}")
    return "\n".join(lines)


def _resolve_override(req: RecipeAnalysisRequest | None) -> tuple[list | None, list | None, int | None]:
    if not req:
        return None, None, None
    return (
        [i.model_dump() for i in req.ingredients] if req.ingredients is not None else None,
        [s.model_dump() for s in req.instructions] if req.instructions is not None else None,
        req.servings,
    )


# ─── Parse Endpoints ──────────────────────────────────────────────────────────

@router.post("/parse", response_model=RecipeResponse, status_code=201)
async def parse_and_save(
    req: RecipeParseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await asyncio.to_thread(_parse_recipe_text, req.raw_text)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    recipe = await _save_recipe(data, current_user.id, db)
    return _orm_to_response(recipe)


@router.post("/parse-image", response_model=RecipeResponse, status_code=201)
async def parse_image_and_save(
    images: list[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(images) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_IMAGES} images allowed")

    image_data_list: list[tuple[str, str]] = []
    for img in images:
        content_type = img.content_type or "image/jpeg"
        if content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail=f"Unsupported image type: {content_type}")
        raw = await img.read()
        if len(raw) > MAX_IMAGE_SIZE:
            raise HTTPException(status_code=400, detail="Each image must be under 10 MB")
        b64 = base64.b64encode(raw).decode()
        image_data_list.append((b64, content_type))

    def _do_vision():
        result = vision_completion(RECIPE_IMAGE_SYSTEM_PROMPT, image_data_list)
        if "error" in result and "content" not in result:
            raise ValueError(result["error"])
        return _extract_json(result.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_vision)
    except ValueError as e:
        detail = str(e)
        if "not a recipe" in detail.lower():
            raise HTTPException(status_code=422, detail="not_a_recipe")
        raise HTTPException(status_code=422, detail=detail)

    recipe = await _save_recipe(data, current_user.id, db)
    return _orm_to_response(recipe)


@router.post("/parse-url", response_model=RecipeResponse, status_code=201)
async def parse_url_and_save(
    req: RecipeURLParseRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    def _do_scrape():
        result = scrape_recipe_url(req.url)
        data = _extract_json(result.get("content", ""))
        image_url = result.get("image_url")
        return data, image_url

    try:
        data, image_url = await asyncio.to_thread(_do_scrape)
    except ValueError as e:
        detail = str(e)
        if "not a recipe" in detail.lower():
            raise HTTPException(status_code=422, detail="not_a_recipe")
        if "timed out" in detail.lower() or "timeout" in detail.lower():
            raise HTTPException(status_code=422, detail="url_timeout")
        if "could not fetch" in detail.lower():
            raise HTTPException(status_code=422, detail="url_unreachable")
        raise HTTPException(status_code=422, detail=detail)

    recipe = await _save_recipe(data, current_user.id, db, image_url=image_url)
    return _orm_to_response(recipe)


@router.post("/generate", response_model=RecipeResponse, status_code=201)
async def generate_and_save(
    req: RecipeGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a full recipe from a title, description, and ingredient list."""
    user_msg = (
        f"Title: {req.title}\n"
        f"Description: {req.description}\n"
        f"Ingredients: {', '.join(req.ingredients)}"
    )

    def _do_generate():
        result = chat_completion(
            messages=[
                {"role": "system", "content": RECIPE_GENERATE_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            model="gpt-4o-mini",
            temperature=0.5,
        )
        if "error" in result and "content" not in result:
            raise ValueError(result["error"])
        return _extract_json(result.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_generate)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    recipe = await _save_recipe(data, current_user.id, db)
    return _orm_to_response(recipe)


# ─── CRUD Endpoints ──────────────────────────────────────────────────────────

@router.get("", response_model=list[RecipeListItem])
async def list_recipes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Recipe)
        .where(Recipe.user_id == current_user.id)
        .order_by(Recipe.created_at.desc())
    )
    recipes = result.scalars().all()
    return [
        RecipeListItem(
            id=r.id,
            title=r.title,
            servings=r.servings,
            ingredient_count=len(r.ingredients) if r.ingredients else 0,
            image_url=r.image_url,
            created_at=r.created_at,
        )
        for r in recipes
    ]


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)
    return _orm_to_response(recipe)


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)
    await db.delete(recipe)
    await db.commit()


@router.patch("/{recipe_id}/notes", response_model=RecipeResponse)
async def update_notes(
    recipe_id: int,
    req: RecipeUpdateNotes,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)
    recipe.notes = req.notes
    await db.commit()
    await db.refresh(recipe)
    return _orm_to_response(recipe)


async def _resolve_working_state_background(recipe_id: int, user_id: int):
    """Open a fresh DB session and fill in ingredient_id values for the
    recipe's working_state. Runs after the PUT response is sent so the
    user-facing save is fast.
    """
    from app.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as db:
            recipe = await db.get(Recipe, recipe_id)
            if not recipe or recipe.user_id != user_id or not recipe.working_state:
                return
            ws = dict(recipe.working_state)
            ings = list(ws.get("ingredients") or [])
            if not any(not (ing.get("ingredient_id")) for ing in ings if isinstance(ing, dict)):
                return  # already fully resolved
            resolved = await _resolve_recipe_ingredients(db, ings, allow_llm=True)
            ws["ingredients"] = resolved
            recipe.working_state = ws
            await db.commit()
    except Exception as e:
        print(f"Background working-state resolve failed for recipe {recipe_id}: {e}")


@router.put("/{recipe_id}/working-state", response_model=RecipeResponse)
async def put_working_state(
    recipe_id: int,
    req: WorkingStatePut,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Persist the recipe's transformed/edited 'working' state.

    Saves the state immediately (DB write only) and schedules ingredient
    resolution to run after the response is sent. Keeps the user-facing
    PUT under ~100ms even when the resolver would otherwise need to call
    the LLM for several new ingredients.
    """
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)
    raw_ings = [i.model_dump() for i in req.ingredients]
    raw_ings = _normalise_ingredients(raw_ings)
    # Cheap exact/fuzzy resolution only — these don't call the LLM, so they
    # finish in milliseconds. Anything unresolved gets handled by the
    # background task.
    resolved_ings = await _resolve_recipe_ingredients(db, raw_ings, allow_llm=False)
    recipe.working_state = {
        "ingredients": resolved_ings,
        "instructions": [s.model_dump() for s in req.instructions],
        "applied_seasonings": [a.model_dump() for a in req.applied_seasonings],
    }
    await db.commit()
    await db.refresh(recipe)
    # Background fill-in for any ingredient_id values still null
    background_tasks.add_task(_resolve_working_state_background, recipe.id, current_user.id)
    return _orm_to_response(recipe)


@router.delete("/{recipe_id}/working-state", response_model=RecipeResponse)
async def clear_working_state(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reset the recipe to the original ingredients/instructions."""
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)
    recipe.working_state = None
    await db.commit()
    await db.refresh(recipe)
    return _orm_to_response(recipe)


@router.post("/{recipe_id}/upload-image", response_model=RecipeResponse)
async def upload_recipe_image(
    recipe_id: int,
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)

    content_type = image.content_type or "image/jpeg"
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {content_type}")

    raw = await image.read()
    if len(raw) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image must be under 10 MB")

    b64 = base64.b64encode(raw).decode()
    recipe.image_url = f"data:{content_type};base64,{b64}"
    await db.commit()
    await db.refresh(recipe)
    return _orm_to_response(recipe)


# ─── Conversion ───────────────────────────────────────────────────────────────

@router.post("/{recipe_id}/convert", response_model=ConvertResponse)
async def convert_recipe(
    recipe_id: int,
    req: ConvertRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)
    converted = convert_ingredients(recipe.ingredients or [], req.target_system)
    return ConvertResponse(ingredients=[Ingredient(**i) for i in converted])


# ─── AI Transformations ──────────────────────────────────────────────────────

@router.post("/{recipe_id}/transform", response_model=TransformResponse)
async def transform_recipe(
    recipe_id: int,
    req: TransformRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)

    base_ings = [i.model_dump() for i in req.base_ingredients] if req.base_ingredients is not None else None
    base_insts = [s.model_dump() for s in req.base_instructions] if req.base_instructions is not None else None
    recipe_text = _recipe_to_text(recipe, ingredients=base_ings, instructions=base_insts)

    # Build transformation description from user preferences for "personalise"
    transformation = req.transformation
    dietary_reqs = list(req.dietary_requirements)

    if transformation == "personalise":
        prefs = current_user.preferences if isinstance(current_user.preferences, dict) else {}
        parts = []
        if prefs.get("diet") in ("veggie", "vegan"):
            parts.append(f"Make it {prefs['diet']}")
        if prefs.get("seasonal"):
            parts.append("Use seasonal ingredients")
        if prefs.get("eco"):
            parts.append("Reduce environmental impact")
        if prefs.get("budget") == "cheap":
            parts.append("Make it budget-friendly")
        elif prefs.get("budget") == "luxurious":
            parts.append("Use premium ingredients")
        favs = prefs.get("favourite_ingredients") or []
        avoids = prefs.get("avoided_ingredients") or []
        if favs:
            parts.append(
                f"Where it fits the dish, prefer these favourites: {', '.join(favs)}"
            )
        if avoids:
            parts.append(
                f"Swap these out where you can (soft preference, not a hard restriction): {', '.join(avoids)}"
            )
        dietary_reqs.extend(prefs.get("dietary_requirements", []))
        transformation = " + ".join(parts) if parts else "seasonal"

    dietary_str = ", ".join(set(dietary_reqs)) if dietary_reqs else "None"

    user_msg = (
        f"Transformation: {transformation}\n"
        f"Dietary requirements: {dietary_str}\n\n"
        f"Recipe:\n{recipe_text}"
    )

    def _do_transform():
        result = chat_completion(
            messages=[
                {"role": "system", "content": RECIPE_TRANSFORM_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            model="gpt-4o-mini",
            temperature=0.3,
        )
        if "error" in result and "content" not in result:
            raise ValueError(result["error"])
        return _extract_json(result.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_transform)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Normalise ingredients: coerce unit_system to the allowed literal, drop unknown extras
    raw_ingredients = data.get("ingredients") or []
    for ing in raw_ingredients:
        if not isinstance(ing, dict):
            continue
        us = (ing.get("unit_system") or "").strip().lower()
        if us not in ("us_customary", "metric"):
            ing["unit_system"] = "metric" if us in ("metric", "si") else "us_customary"
    raw_ingredients = _normalise_ingredients(raw_ingredients)

    # Normalise reasoning: must be dict[str, str]. Stringify nested values defensively.
    raw_reasoning = data.get("reasoning") or {}
    if not isinstance(raw_reasoning, dict):
        raw_reasoning = {}
    reasoning: dict[str, str] = {}
    for k, v in raw_reasoning.items():
        key = str(k)
        if isinstance(v, str):
            reasoning[key] = v
        elif isinstance(v, dict):
            reasoning[key] = " ".join(f"{sk}: {sv}" for sk, sv in v.items())
        else:
            reasoning[key] = str(v)

    try:
        return TransformResponse(
            ingredients=[Ingredient(**i) for i in raw_ingredients if isinstance(i, dict)],
            instructions=[InstructionStep(**s) for s in (data.get("instructions") or []) if isinstance(s, dict)],
            reasoning=reasoning,
        )
    except ValidationError as e:
        print(f"Transform response validation failed. Raw data: {data}")
        print(f"Validation error: {e}")
        raise HTTPException(status_code=422, detail="AI returned a recipe in an unexpected format. Please try again.")


@router.post("/{recipe_id}/substitute", response_model=SubstitutionResponse)
async def substitute_ingredient(
    recipe_id: int,
    req: SubstitutionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)

    dietary_str = ", ".join(req.dietary_requirements) if req.dietary_requirements else "None"

    base_ings = [i.model_dump() for i in req.base_ingredients] if req.base_ingredients is not None else None

    user_msg = (
        f"Recipe: {req.recipe_title}\n"
        f"Ingredient to swap: {req.ingredient_item}\n"
        f"Dietary requirements: {dietary_str}\n"
    )
    if req.custom_constraint:
        user_msg += f"User's extra constraint: {req.custom_constraint}\n"
    user_msg += f"\nFull recipe context:\n{_recipe_to_text(recipe, ingredients=base_ings)}"

    def _do_substitute():
        result = chat_completion(
            messages=[
                {"role": "system", "content": INGREDIENT_SUBSTITUTE_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            model="gpt-4o-mini",
            temperature=0.4,
        )
        if "error" in result and "content" not in result:
            raise ValueError(result["error"])
        return _extract_json(result.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_substitute)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    raw_options = data.get("options") or []
    options: list[SubstitutionOption] = []
    for opt in raw_options:
        if not isinstance(opt, dict):
            continue
        sub = (opt.get("substitute") or "").strip()
        if not sub:
            continue
        # Coerce quantity to float if the LLM returned a string like "1/2"
        raw_qty = opt.get("quantity")
        qty: float | None = None
        if isinstance(raw_qty, (int, float)):
            qty = float(raw_qty)
        elif isinstance(raw_qty, str) and raw_qty.strip():
            try:
                qty = float(raw_qty)
            except ValueError:
                qty = None
        options.append(SubstitutionOption(
            substitute=sub,
            tag=str(opt.get("tag") or "alternative").strip().lower(),
            reasoning=str(opt.get("reasoning") or ""),
            quantity=qty,
            unit=(opt.get("unit") or None),
            item=(opt.get("item") or None),
            preparation=(opt.get("preparation") or ""),
        ))

    # Back-compat: pick the first option as the "primary" substitute
    primary_sub = options[0].substitute if options else (data.get("substitute") or "")
    primary_reason = options[0].reasoning if options else (data.get("reasoning") or "")

    return SubstitutionResponse(
        original=data.get("original", req.ingredient_item),
        substitute=primary_sub,
        reasoning=primary_reason,
        options=options,
    )


_LOCAL_RESOLUTION_THRESHOLD = 0.5  # if half+ resolve locally, prefer local over LLM


@router.post("/{recipe_id}/nutrition", response_model=NutritionResponse)
async def get_nutrition(
    recipe_id: int,
    req: RecipeAnalysisRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)

    o_ings, o_insts, o_serv = _resolve_override(req)
    target_ings = o_ings if o_ings is not None else (recipe.ingredients or [])
    target_serv = o_serv if o_serv is not None else (recipe.servings or 1)

    # Try local computation from the canonical taxonomy
    local_target_ings = await _resolve_recipe_ingredients(db, list(target_ings), allow_llm=True)
    metrics = await compute_metrics(db, local_target_ings, target_serv)
    if metrics.resolution_rate >= _LOCAL_RESOLUTION_THRESHOLD:
        return NutritionResponse(
            servings=metrics.servings,
            per_serving=NutritionPerServing(
                calories=metrics.calories,
                protein_g=metrics.protein_g,
                carbs_g=metrics.carbs_g,
                fat_g=metrics.fat_g,
                saturated_fat_g=metrics.saturated_fat_g,
                fiber_g=metrics.fiber_g,
                sugar_g=metrics.sugar_g,
                sodium_mg=metrics.sodium_mg,
            ),
        )

    # Fall back to LLM if too many ingredients are unresolved
    recipe_text = _recipe_to_text(recipe, ingredients=o_ings, instructions=o_insts, servings=o_serv)

    def _do_nutrition():
        result = chat_completion(
            messages=[
                {"role": "system", "content": NUTRITION_SYSTEM_PROMPT},
                {"role": "user", "content": recipe_text},
            ],
            model="gpt-4o-mini",
            temperature=0.2,
        )
        if "error" in result and "content" not in result:
            raise ValueError(result["error"])
        return _extract_json(result.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_nutrition)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    per_serving = data.get("per_serving", data)
    return NutritionResponse(
        servings=data.get("servings", o_serv or recipe.servings or 1),
        per_serving=NutritionPerServing(**per_serving),
    )


# ─── Cost Estimate ────────────────────────────────────────────────────────────

@router.post("/{recipe_id}/cost", response_model=CostResponse)
async def estimate_cost(
    recipe_id: int,
    req: RecipeAnalysisRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)

    currency = current_user.currency or "GBP"
    o_ings, o_insts, o_serv = _resolve_override(req)
    target_ings = o_ings if o_ings is not None else (recipe.ingredients or [])
    target_serv = o_serv if o_serv is not None else (recipe.servings or 1)

    local_target_ings = await _resolve_recipe_ingredients(db, list(target_ings), allow_llm=True)
    metrics = await compute_metrics(db, local_target_ings, target_serv)
    if metrics.resolution_rate >= _LOCAL_RESOLUTION_THRESHOLD and metrics.cost_total_gbp > 0:
        return CostResponse(
            total=round(metrics.cost_total_gbp, 2),
            per_serving=round(metrics.cost_per_serving_gbp, 2),
            currency="GBP",
            breakdown=[],
        )

    recipe_text = _recipe_to_text(recipe, ingredients=o_ings, instructions=o_insts, servings=o_serv)

    def _do_cost():
        result = chat_completion(
            messages=[
                {"role": "system", "content": COST_ESTIMATE_SYSTEM_PROMPT},
                {"role": "user", "content": f"Currency: {currency}\n\n{recipe_text}"},
            ],
            model="gpt-4o-mini",
            temperature=0.2,
        )
        if "error" in result and "content" not in result:
            raise ValueError(result["error"])
        return _extract_json(result.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_cost)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return CostResponse(
        total=data.get("total", 0),
        per_serving=data.get("per_serving", 0),
        currency=data.get("currency", currency),
        breakdown=data.get("breakdown", []),
    )


# ─── Environmental Impact ────────────────────────────────────────────────────

@router.post("/{recipe_id}/impact", response_model=ImpactResponse)
async def estimate_impact(
    recipe_id: int,
    req: RecipeAnalysisRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)

    o_ings, o_insts, o_serv = _resolve_override(req)
    target_ings = o_ings if o_ings is not None else (recipe.ingredients or [])
    target_serv = o_serv if o_serv is not None else (recipe.servings or 1)

    local_target_ings = await _resolve_recipe_ingredients(db, list(target_ings), allow_llm=True)
    metrics = await compute_metrics(db, local_target_ings, target_serv)
    if metrics.resolution_rate >= _LOCAL_RESOLUTION_THRESHOLD and metrics.kg_co2e_total > 0:
        return ImpactResponse(
            kg_co2e_per_serving=round(metrics.kg_co2e_per_serving, 2),
            kg_co2e_total=round(metrics.kg_co2e_total, 2),
            rating=impact_rating(metrics.kg_co2e_per_serving),
            summary="",
            breakdown=[],
        )

    recipe_text = _recipe_to_text(recipe, ingredients=o_ings, instructions=o_insts, servings=o_serv)

    def _do_impact():
        result = chat_completion(
            messages=[
                {"role": "system", "content": IMPACT_ESTIMATE_SYSTEM_PROMPT},
                {"role": "user", "content": recipe_text},
            ],
            model="gpt-4o-mini",
            temperature=0.2,
        )
        if "error" in result and "content" not in result:
            raise ValueError(result["error"])
        return _extract_json(result.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_impact)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    rating = (data.get("rating") or "medium").strip().lower()
    if rating not in ("low", "medium", "high"):
        rating = "medium"

    return ImpactResponse(
        kg_co2e_per_serving=float(data.get("kg_co2e_per_serving", 0)),
        kg_co2e_total=float(data.get("kg_co2e_total", 0)),
        rating=rating,
        summary=str(data.get("summary", "")),
        breakdown=data.get("breakdown", []) or [],
    )


# ─── Copy Friend's Recipe ────────────────────────────────────────────────────

@router.post("/{recipe_id}/copy", response_model=RecipeResponse, status_code=201)
async def copy_recipe(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Copy a friend's recipe to your own collection."""
    from sqlalchemy import or_, and_

    original = await db.get(Recipe, recipe_id)
    if not original:
        raise HTTPException(status_code=404, detail="Recipe not found")

    if original.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="This is already your recipe")

    # Verify friendship
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == original.user_id),
                and_(Friendship.user_id == original.user_id, Friendship.friend_id == current_user.id),
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not friends with recipe owner")

    copy = Recipe(
        user_id=current_user.id,
        title=original.title,
        servings=original.servings,
        ingredients=original.ingredients,
        instructions=original.instructions,
        image_url=original.image_url if original.image_url and original.image_url.startswith("http") else None,
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)
    return _orm_to_response(copy)
