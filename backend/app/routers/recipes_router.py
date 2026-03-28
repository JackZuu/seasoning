import asyncio
import base64
import json
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import ValidationError

from app.database import get_db
from app.models import Recipe
from app.schemas import (
    RecipeParseRequest, RecipeCreate, RecipeResponse, RecipeListItem,
    ConvertRequest, ConvertResponse, Ingredient, InstructionStep,
    RecipeURLParseRequest, RecipeUpdateNotes,
    TransformRequest, TransformResponse,
    SubstitutionRequest, SubstitutionResponse,
    NutritionResponse, NutritionPerServing,
    CostResponse,
)
from app.auth import get_current_user
from app.models import User, Friendship
from app.openai_module import chat_completion, vision_completion
from app.prompts import (
    RECIPE_PARSE_SYSTEM_PROMPT, RECIPE_IMAGE_SYSTEM_PROMPT,
    RECIPE_TRANSFORM_SYSTEM_PROMPT, INGREDIENT_SUBSTITUTE_SYSTEM_PROMPT,
    NUTRITION_SYSTEM_PROMPT, COST_ESTIMATE_SYSTEM_PROMPT,
)
from app.conversions import convert_ingredients
from app.scraper import scrape_recipe_url

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
    return RecipeResponse(
        id=recipe.id,
        user_id=recipe.user_id,
        title=recipe.title,
        servings=recipe.servings,
        ingredients=[Ingredient(**i) for i in (recipe.ingredients or [])],
        instructions=[InstructionStep(**s) for s in (recipe.instructions or [])],
        image_url=recipe.image_url,
        notes=recipe.notes or "",
        created_at=recipe.created_at,
    )


def _assert_ownership(recipe: Recipe | None, user_id: int):
    if not recipe or recipe.user_id != user_id:
        raise HTTPException(status_code=404, detail="Recipe not found")


async def _save_recipe(data: dict, user_id: int, db: AsyncSession, image_url: str | None = None) -> Recipe:
    try:
        recipe_data = RecipeCreate(**data)
    except (ValidationError, Exception) as e:
        raise HTTPException(status_code=422, detail=f"Recipe format invalid: {str(e)}")

    recipe = Recipe(
        user_id=user_id,
        title=recipe_data.title,
        servings=recipe_data.servings,
        ingredients=[ing.model_dump() for ing in recipe_data.ingredients],
        instructions=[step.model_dump() for step in recipe_data.instructions],
        image_url=image_url or recipe_data.image_url,
    )
    db.add(recipe)
    await db.commit()
    await db.refresh(recipe)
    return recipe


def _recipe_to_text(recipe: Recipe) -> str:
    """Convert a recipe to a text summary for AI context."""
    lines = [f"Title: {recipe.title}", f"Servings: {recipe.servings or 'unknown'}"]
    lines.append("\nIngredients:")
    for ing in (recipe.ingredients or []):
        qty = ing.get("quantity", "")
        unit = ing.get("unit", "") or ""
        item = ing.get("item", "")
        prep = ing.get("preparation", "")
        line = f"- {qty} {unit} {item}".strip()
        if prep:
            line += f", {prep}"
        lines.append(line)
    lines.append("\nInstructions:")
    for step in (recipe.instructions or []):
        lines.append(f"{step.get('step', '')}. {step.get('text', '')}")
    return "\n".join(lines)


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
            image_url=r.image_url if r.image_url and r.image_url.startswith("http") else None,
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

    recipe_text = _recipe_to_text(recipe)

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

    return TransformResponse(
        ingredients=[Ingredient(**i) for i in data.get("ingredients", [])],
        instructions=[InstructionStep(**s) for s in data.get("instructions", [])],
        reasoning=data.get("reasoning", {}),
    )


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

    user_msg = (
        f"Recipe: {req.recipe_title}\n"
        f"Ingredient I don't have: {req.ingredient_item}\n"
        f"Dietary requirements: {dietary_str}\n\n"
        f"Full recipe context:\n{_recipe_to_text(recipe)}"
    )

    def _do_substitute():
        result = chat_completion(
            messages=[
                {"role": "system", "content": INGREDIENT_SUBSTITUTE_SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            model="gpt-4o-mini",
            temperature=0.3,
        )
        if "error" in result and "content" not in result:
            raise ValueError(result["error"])
        return _extract_json(result.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_substitute)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return SubstitutionResponse(
        original=data.get("original", req.ingredient_item),
        substitute=data.get("substitute", ""),
        reasoning=data.get("reasoning", ""),
    )


@router.post("/{recipe_id}/nutrition", response_model=NutritionResponse)
async def get_nutrition(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)

    recipe_text = _recipe_to_text(recipe)

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
        servings=data.get("servings", recipe.servings or 1),
        per_serving=NutritionPerServing(**per_serving),
    )


# ─── Cost Estimate ────────────────────────────────────────────────────────────

@router.post("/{recipe_id}/cost", response_model=CostResponse)
async def estimate_cost(
    recipe_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)

    currency = current_user.currency or "GBP"
    recipe_text = _recipe_to_text(recipe)

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
