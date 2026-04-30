import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.database import get_db
from app.models import User, LarderItem
from app.schemas import LarderItemCreate, LarderItemOut, LarderRecipeSuggestionsResponse, LarderRecipeSuggestion
from app.auth import get_current_user
from app.openai_module import chat_completion
from app.prompts import LARDER_RECIPES_SYSTEM_PROMPT
from app.services.ingredient_resolver import resolve as resolve_ingredient

router = APIRouter(prefix="/api/larder", tags=["larder"])


def _extract_json(content: str) -> dict:
    import json
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
    return json.loads(content)


@router.get("", response_model=list[LarderItemOut])
async def list_larder(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LarderItem).where(LarderItem.user_id == current_user.id).order_by(LarderItem.category, LarderItem.item)
    )
    items = result.scalars().all()
    return [
        LarderItemOut(id=i.id, item=i.item, category=i.category, ingredient_id=i.ingredient_id)
        for i in items
    ]


@router.post("", response_model=LarderItemOut, status_code=201)
async def add_larder_item(
    req: LarderItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Resolve to canonical taxonomy. LLM fallback fills the table on first
    # encounter; subsequent uses hit exact match.
    canonical = None
    try:
        canonical = await resolve_ingredient(db, req.item, allow_llm=True)
    except Exception as e:
        print(f"Larder resolver failed for '{req.item}': {e}")

    display_item = canonical.canonical_name if canonical else req.item
    item = LarderItem(
        user_id=current_user.id,
        item=display_item,
        category=req.category,
        ingredient_id=canonical.id if canonical else None,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return LarderItemOut(id=item.id, item=item.item, category=item.category, ingredient_id=item.ingredient_id)


@router.delete("/{item_id}", status_code=204)
async def remove_larder_item(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(LarderItem, item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()


@router.post("/generate-recipes", response_model=LarderRecipeSuggestionsResponse)
async def generate_recipes_from_larder(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LarderItem).where(LarderItem.user_id == current_user.id)
    )
    items = result.scalars().all()
    if not items:
        raise HTTPException(status_code=400, detail="Add some items to your larder first")

    item_list = ", ".join(i.item for i in items)

    def _do_generate():
        resp = chat_completion(
            messages=[
                {"role": "system", "content": LARDER_RECIPES_SYSTEM_PROMPT},
                {"role": "user", "content": f"My larder contains: {item_list}"},
            ],
            model="gpt-4o-mini",
            temperature=0.7,
        )
        if "error" in resp and "content" not in resp:
            raise ValueError(resp["error"])
        return _extract_json(resp.get("content", ""))

    try:
        data = await asyncio.to_thread(_do_generate)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))

    suggestions = [LarderRecipeSuggestion(**s) for s in data.get("suggestions", [])]
    return LarderRecipeSuggestionsResponse(suggestions=suggestions)
