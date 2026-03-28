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
    display_name: Optional[str] = None
    recipe_book_name: Optional[str] = "Your Recipe Book"
    currency: Optional[str] = "GBP"
    preferences: Optional[dict] = None

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

class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = None
    recipe_book_name: Optional[str] = None
    currency: Optional[str] = None
    preferences: Optional[dict] = None


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
    image_url: Optional[str] = None

class RecipeListItem(BaseModel):
    id: int
    title: str
    servings: Optional[int] = None
    ingredient_count: int
    image_url: Optional[str] = None
    created_at: datetime

class RecipeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    servings: Optional[int] = None
    ingredients: list[Ingredient]
    instructions: list[InstructionStep]
    image_url: Optional[str] = None
    notes: Optional[str] = ""
    created_at: datetime


# ─── Conversion ───────────────────────────────────────────────────────────────

class ConvertRequest(BaseModel):
    target_system: Literal["us_customary", "metric"]

class ConvertResponse(BaseModel):
    ingredients: list[Ingredient]


# ─── Notes ────────────────────────────────────────────────────────────────────

class RecipeUpdateNotes(BaseModel):
    notes: str


# ─── AI Transformations ──────────────────────────────────────────────────────

class TransformRequest(BaseModel):
    transformation: Literal["veggie", "vegan", "seasonal", "eco", "cheaper", "luxurious", "personalise"]
    dietary_requirements: list[str] = []

class TransformResponse(BaseModel):
    ingredients: list[Ingredient]
    instructions: list[InstructionStep]
    reasoning: dict[str, str]

class SubstitutionRequest(BaseModel):
    ingredient_item: str
    recipe_title: str
    dietary_requirements: list[str] = []

class SubstitutionResponse(BaseModel):
    original: str
    substitute: str
    reasoning: str


# ─── Nutrition ────────────────────────────────────────────────────────────────

class NutritionPerServing(BaseModel):
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    saturated_fat_g: float = 0
    fiber_g: float = 0
    sugar_g: float = 0
    sodium_mg: float = 0

class NutritionResponse(BaseModel):
    servings: int
    per_serving: NutritionPerServing


# ─── Cost ─────────────────────────────────────────────────────────────────────

class CostResponse(BaseModel):
    total: float
    per_serving: float
    currency: str
    breakdown: list[dict]


# ─── Larder ───────────────────────────────────────────────────────────────────

class LarderItemCreate(BaseModel):
    item: str
    category: str = "Other"

class LarderItemOut(BaseModel):
    id: int
    item: str
    category: str

class LarderRecipeSuggestion(BaseModel):
    title: str
    description: str
    key_ingredients: list[str]
    missing_ingredients: list[str]

class LarderRecipeSuggestionsResponse(BaseModel):
    suggestions: list[LarderRecipeSuggestion]


# ─── Friends ──────────────────────────────────────────────────────────────────

class FriendSearchResult(BaseModel):
    id: int
    display_name: str

class FriendshipOut(BaseModel):
    id: int
    user: FriendSearchResult
    status: str

class InviteOut(BaseModel):
    id: int
    from_user: FriendSearchResult
    created_at: datetime


# ─── Shopping List (Basket) ───────────────────────────────────────────────────

class ShoppingListItemCreate(BaseModel):
    item: str
    category: str = "Other"
    quantity: Optional[str] = None

class ShoppingListItemOut(BaseModel):
    id: int
    item: str
    category: str
    quantity: Optional[str] = None
    checked: bool
    recipe_id: Optional[int] = None

class AddRecipeToBasketRequest(BaseModel):
    recipe_id: int
    ingredients: list[Ingredient]
