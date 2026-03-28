from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_

from app.database import get_db
from app.models import User, Friendship, Recipe
from app.schemas import (
    FriendSearchResult, FriendshipOut, InviteOut,
    RecipeListItem,
)
from app.auth import get_current_user
from app.email import send_friend_invite_email, send_friend_accepted_email

router = APIRouter(prefix="/api/friends", tags=["friends"])


@router.get("/search", response_model=list[FriendSearchResult])
async def search_users(
    q: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if len(q) < 2:
        return []
    result = await db.execute(
        select(User).where(
            User.display_name.ilike(f"%{q}%"),
            User.id != current_user.id,
        ).limit(10)
    )
    users = result.scalars().all()
    return [FriendSearchResult(id=u.id, display_name=u.display_name or u.email) for u in users]


@router.post("/invite/{user_id}", status_code=201)
async def send_invite(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Can't add yourself")

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Check existing friendship
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == user_id),
                and_(Friendship.user_id == user_id, Friendship.friend_id == current_user.id),
            )
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Already connected or invite pending")

    friendship = Friendship(user_id=current_user.id, friend_id=user_id, status="pending")
    db.add(friendship)
    await db.commit()

    from_name = current_user.display_name or current_user.email
    send_friend_invite_email(target.email, from_name)

    return {"message": "Invite sent"}


@router.get("/invites", response_model=list[InviteOut])
async def get_invites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Friendship).where(
            Friendship.friend_id == current_user.id,
            Friendship.status == "pending",
        )
    )
    invites = result.scalars().all()
    out = []
    for inv in invites:
        sender = await db.get(User, inv.user_id)
        out.append(InviteOut(
            id=inv.id,
            from_user=FriendSearchResult(id=sender.id, display_name=sender.display_name or sender.email),
            created_at=inv.created_at,
        ))
    return out


@router.post("/accept/{friendship_id}", status_code=200)
async def accept_invite(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    friendship = await db.get(Friendship, friendship_id)
    if not friendship or friendship.friend_id != current_user.id or friendship.status != "pending":
        raise HTTPException(status_code=404, detail="Invite not found")

    friendship.status = "accepted"
    await db.commit()

    sender = await db.get(User, friendship.user_id)
    my_name = current_user.display_name or current_user.email
    send_friend_accepted_email(sender.email, my_name)

    return {"message": "Friend added"}


@router.post("/decline/{friendship_id}", status_code=204)
async def decline_invite(
    friendship_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    friendship = await db.get(Friendship, friendship_id)
    if not friendship or friendship.friend_id != current_user.id or friendship.status != "pending":
        raise HTTPException(status_code=404, detail="Invite not found")
    await db.delete(friendship)
    await db.commit()


@router.get("", response_model=list[FriendSearchResult])
async def list_friends(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Friendship).where(
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.status == "accepted"),
                and_(Friendship.friend_id == current_user.id, Friendship.status == "accepted"),
            )
        )
    )
    friendships = result.scalars().all()
    friends = []
    for f in friendships:
        fid = f.friend_id if f.user_id == current_user.id else f.user_id
        user = await db.get(User, fid)
        if user:
            friends.append(FriendSearchResult(id=user.id, display_name=user.display_name or user.email))
    return friends


@router.get("/{friend_id}/recipes", response_model=list[RecipeListItem])
async def get_friend_recipes(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify friendship
    result = await db.execute(
        select(Friendship).where(
            Friendship.status == "accepted",
            or_(
                and_(Friendship.user_id == current_user.id, Friendship.friend_id == friend_id),
                and_(Friendship.user_id == friend_id, Friendship.friend_id == current_user.id),
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not friends with this user")

    result = await db.execute(
        select(Recipe).where(Recipe.user_id == friend_id).order_by(Recipe.created_at.desc())
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
