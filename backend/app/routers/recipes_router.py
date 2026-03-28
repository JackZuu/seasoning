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
    RecipeURLParseRequest,
)
from app.auth import get_current_user
from app.models import User
from app.openai_module import chat_completion, vision_completion
from app.prompts import RECIPE_PARSE_SYSTEM_PROMPT, RECIPE_IMAGE_SYSTEM_PROMPT
from app.conversions import convert_ingredients
from app.scraper import scrape_recipe_url

router = APIRouter(prefix="/api/recipes", tags=["recipes"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic"}
MAX_IMAGES = 5
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _extract_json(content: str) -> dict:
    """Extract a JSON object from an LLM response, stripping markdown fences."""
    # Strip markdown code fences if present
    if "```json" in content:
        start = content.find("```json") + 7
        end = content.find("```", start)
        content = content[start:end].strip()
    elif "```" in content:
        start = content.find("```") + 3
        end = content.find("```", start)
        content = content[start:end].strip()

    # Extract the JSON object
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
    """Synchronous helper: call OpenAI and extract recipe JSON."""
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
        created_at=recipe.created_at,
    )


def _assert_ownership(recipe: Recipe | None, user_id: int):
    if not recipe or recipe.user_id != user_id:
        raise HTTPException(status_code=404, detail="Recipe not found")


async def _save_recipe(data: dict, user_id: int, db: AsyncSession) -> Recipe:
    """Validate parsed data and save to DB."""
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
    )
    db.add(recipe)
    await db.commit()
    await db.refresh(recipe)
    return recipe


# ─── Endpoints ────────────────────────────────────────────────────────────────

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
        # scrape_recipe_url returns the raw OpenAI result dict with "content"
        return _extract_json(result.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_scrape)
    except ValueError as e:
        detail = str(e)
        if "not a recipe" in detail.lower():
            raise HTTPException(status_code=422, detail="not_a_recipe")
        raise HTTPException(status_code=422, detail=detail)

    recipe = await _save_recipe(data, current_user.id, db)
    return _orm_to_response(recipe)


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


@router.post("/{recipe_id}/convert", response_model=ConvertResponse)
async def convert_recipe(
    recipe_id: int,
    req: ConvertRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    recipe = await db.get(Recipe, recipe_id)
    _assert_ownership(recipe, current_user.id)

    # Always convert from the original stored data
    converted = convert_ingredients(recipe.ingredients or [], req.target_system)
    return ConvertResponse(ingredients=[Ingredient(**i) for i in converted])
