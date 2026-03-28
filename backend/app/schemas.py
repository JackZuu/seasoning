from __future__ import annotations
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, ConfigDict


# ─── Auth ─────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    message: str

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    token: str
    new_password: str

class ResetPasswordResponse(BaseModel):
    message: str


# ─── Recipe sub-models ────────────────────────────────────────────────────────

class Ingredient(BaseModel):
    quantity: Optional[float] = None
    unit: Optional[str] = None
    unit_system: Literal["us_customary", "metric"] = "us_customary"
    item: str
    preparation: str = ""
    notes: str = ""

class InstructionStep(BaseModel):
    step: int
    text: str
    duration_minutes: Optional[int] = None
    # Extensible: future AI transformations can add tags (e.g. "vegetarian-swap")
    technique_tags: list[str] = []


# ─── Recipe ───────────────────────────────────────────────────────────────────

class RecipeParseRequest(BaseModel):
    raw_text: str

class RecipeURLParseRequest(BaseModel):
    url: str

class RecipeCreate(BaseModel):
    title: str
    servings: Optional[int] = None
    ingredients: list[Ingredient]
    instructions: list[InstructionStep]

class RecipeListItem(BaseModel):
    id: int
    title: str
    servings: Optional[int] = None
    ingredient_count: int
    created_at: datetime

class RecipeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    servings: Optional[int] = None
    ingredients: list[Ingredient]
    instructions: list[InstructionStep]
    created_at: datetime


# ─── Conversion ───────────────────────────────────────────────────────────────

class ConvertRequest(BaseModel):
    target_system: Literal["us_customary", "metric"]

class ConvertResponse(BaseModel):
    ingredients: list[Ingredient]
