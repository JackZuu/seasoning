import secrets
from datetime import datetime, timedelta, timezone

import os

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError

from app.database import get_db
from app.models import User, PasswordResetToken
from app.schemas import (
    SignupRequest, LoginRequest, AuthResponse, UserOut,
    ForgotPasswordRequest, ForgotPasswordResponse,
    ResetPasswordRequest, ResetPasswordResponse,
    UpdateProfileRequest,
)
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.email import send_password_reset, send_welcome_email

router = APIRouter(prefix="/api/auth", tags=["auth"])

RESET_TOKEN_EXPIRE_MINUTES = 30


def _validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")


def _user_out(user: User) -> UserOut:
    prefs = user.preferences if isinstance(user.preferences, dict) else {}
    return UserOut(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        recipe_book_name=user.recipe_book_name or "Your Recipe Book",
        currency=user.currency or "GBP",
        preferences=prefs,
    )


@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    _validate_password(req.password)
    user = User(email=req.email, password_hash=hash_password(req.password))
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email already registered")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return AuthResponse(access_token=token, user=_user_out(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return AuthResponse(access_token=token, user=_user_out(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return _user_out(current_user)


@router.patch("/profile", response_model=UserOut)
async def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if req.display_name is not None:
        # Send welcome email on first name set
        if not current_user.display_name:
            try:
                send_welcome_email(current_user.email, req.display_name)
            except Exception as e:
                print(f"Welcome email failed: {e}")
        current_user.display_name = req.display_name
    if req.recipe_book_name is not None:
        current_user.recipe_book_name = req.recipe_book_name
    if req.currency is not None:
        current_user.currency = req.currency
    if req.preferences is not None:
        current_user.preferences = req.preferences
    await db.commit()
    await db.refresh(current_user)
    return _user_out(current_user)


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(req: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Always returns success to avoid leaking whether an email exists."""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if user:
        # Delete any existing tokens for this user
        await db.execute(
            delete(PasswordResetToken).where(PasswordResetToken.user_id == user.id)
        )

        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
        db.add(PasswordResetToken(
            user_id=user.id,
            token_hash=hash_password(token),
            expires_at=expires_at,
        ))
        await db.commit()

        base_url = os.getenv("APP_URL", str(request.base_url)).rstrip("/")
        # Strip any trailing path — APP_URL must be origin only (no /dashboard etc.)
        from urllib.parse import urlparse, urlunparse
        parsed = urlparse(base_url)
        base_url = urlunparse((parsed.scheme or "https", parsed.netloc, "", "", "", ""))
        reset_link = f"{base_url}/reset-password?token={token}&email={req.email}"
        send_password_reset(req.email, reset_link)

    return ForgotPasswordResponse(message="If that email exists, a reset link has been sent.")


@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    _validate_password(req.new_password)

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    # Find a valid (non-expired) token for this user
    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    reset_row = result.scalar_one_or_none()

    if not reset_row or not verify_password(req.token, reset_row.token_hash):
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")

    # Update password and delete the token
    user.password_hash = hash_password(req.new_password)
    await db.delete(reset_row)
    await db.commit()

    return ResetPasswordResponse(message="Password has been reset. You can now log in.")
