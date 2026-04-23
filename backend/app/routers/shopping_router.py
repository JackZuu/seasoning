from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update

from app.database import get_db
from app.models import User, ShoppingListItem, LarderItem
from app.schemas import (
    ShoppingListItemCreate, ShoppingListItemOut,
    AddRecipeToBasketRequest, AddRecipeToBasketResponse,
)
from app.auth import get_current_user

router = APIRouter(prefix="/api/basket", tags=["basket"])


@router.get("", response_model=list[ShoppingListItemOut])
async def list_basket(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ShoppingListItem)
        .where(ShoppingListItem.user_id == current_user.id)
        .order_by(ShoppingListItem.category, ShoppingListItem.item)
    )
    items = result.scalars().all()
    return [
        ShoppingListItemOut(
            id=i.id, item=i.item, category=i.category,
            quantity=i.quantity, checked=i.checked, recipe_id=i.recipe_id,
        )
        for i in items
    ]


@router.post("", response_model=ShoppingListItemOut, status_code=201)
async def add_to_basket(
    req: ShoppingListItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = ShoppingListItem(
        user_id=current_user.id,
        item=req.item,
        category=req.category,
        quantity=req.quantity,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return ShoppingListItemOut(
        id=item.id, item=item.item, category=item.category,
        quantity=item.quantity, checked=item.checked, recipe_id=item.recipe_id,
    )


def _in_larder(ingredient_item: str, larder_names: list[str]) -> bool:
    """
    Match ingredient against larder. Case-insensitive, word-boundary-aware.
    'oregano' in larder matches 'oregano' or 'fresh oregano' or 'oregano leaves'.
    """
    ing = ingredient_item.lower().strip()
    padded = f" {ing} "
    for name in larder_names:
        if not name:
            continue
        if name == ing:
            return True
        if f" {name} " in padded:
            return True
        if padded.startswith(f" {name} ") or padded.endswith(f" {name} "):
            return True
    return False


@router.post("/from-recipe", status_code=201, response_model=AddRecipeToBasketResponse)
async def add_recipe_to_basket(
    req: AddRecipeToBasketRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a recipe's ingredients to the basket, skipping anything already in the larder."""
    larder_result = await db.execute(
        select(LarderItem).where(LarderItem.user_id == current_user.id)
    )
    larder_names = [li.item.lower().strip() for li in larder_result.scalars().all()]

    added = 0
    skipped: list[str] = []

    for ing in req.ingredients:
        if larder_names and _in_larder(ing.item, larder_names):
            skipped.append(ing.item)
            continue

        qty_str = ""
        if ing.quantity is not None:
            qty_str = str(ing.quantity)
            if ing.unit:
                qty_str += f" {ing.unit}"

        item = ShoppingListItem(
            user_id=current_user.id,
            item=ing.item,
            category="Ingredients",
            quantity=qty_str or None,
            recipe_id=req.recipe_id,
        )
        db.add(item)
        added += 1

    await db.commit()
    return AddRecipeToBasketResponse(added=added, skipped_in_larder=skipped)


@router.patch("/{item_id}/check")
async def toggle_check(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(ShoppingListItem, item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    item.checked = not item.checked
    await db.commit()
    return {"checked": item.checked}


@router.delete("/{item_id}", status_code=204)
async def remove_from_basket(
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(ShoppingListItem, item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    await db.commit()


@router.delete("/clear/completed", status_code=204)
async def clear_completed(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(ShoppingListItem).where(
            ShoppingListItem.user_id == current_user.id,
            ShoppingListItem.checked == True,
        )
    )
    await db.commit()


@router.delete("/clear/all", status_code=204)
async def clear_basket(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(ShoppingListItem).where(ShoppingListItem.user_id == current_user.id)
    )
    await db.commit()
