from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, JSON, ForeignKey, DateTime, Boolean, Numeric
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, nullable=True)
    recipe_book_name = Column(String, nullable=True, default="Your Recipe Book")
    currency = Column(String, nullable=True, default="GBP")
    preferences = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(Text, nullable=False)
    servings = Column(Integer, nullable=True)
    ingredients = Column(JSON, nullable=False, default=list)
    instructions = Column(JSON, nullable=False, default=list)
    image_url = Column(Text, nullable=True)
    notes = Column(Text, nullable=True, default="")
    working_state = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class LarderItem(Base):
    __tablename__ = "larder_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item = Column(Text, nullable=False)
    category = Column(String, nullable=True, default="Other")
    ingredient_id = Column(Integer, ForeignKey("ingredient.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, nullable=False, default="pending")  # pending, accepted
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class ShoppingListItem(Base):
    __tablename__ = "shopping_list_items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    item = Column(Text, nullable=False)
    category = Column(String, nullable=True, default="Other")
    quantity = Column(String, nullable=True)
    checked = Column(Boolean, nullable=False, default=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class Ingredient(Base):
    """Canonical ingredient taxonomy.

    One row per distinct cooking ingredient. Variants reference a parent
    (beef tomato -> tomato). Pure synonyms are stored in the synonyms array
    on the canonical row (no separate row).
    """
    __tablename__ = "ingredient"

    id = Column(Integer, primary_key=True, index=True)
    canonical_name = Column(String, nullable=False, unique=True, index=True)
    display_name = Column(String, nullable=True)
    parent_id = Column(Integer, ForeignKey("ingredient.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String, nullable=True, index=True)
    # JSON column (cross-DB) holding synonyms as a list of lowercase strings
    synonyms = Column(JSON, nullable=False, default=list)

    # Conversions
    density_g_per_ml = Column(Numeric, nullable=True)
    typical_unit_weight_g = Column(Numeric, nullable=True)
    typical_unit_label = Column(String, nullable=True)

    # Nutrition (per 100g)
    per_100g_calories = Column(Numeric, nullable=True)
    per_100g_protein_g = Column(Numeric, nullable=True)
    per_100g_carbs_g = Column(Numeric, nullable=True)
    per_100g_fat_g = Column(Numeric, nullable=True)
    per_100g_saturated_fat_g = Column(Numeric, nullable=True)
    per_100g_fiber_g = Column(Numeric, nullable=True)
    per_100g_sugar_g = Column(Numeric, nullable=True)
    per_100g_sodium_mg = Column(Numeric, nullable=True)

    # Cost
    cost_per_kg_gbp = Column(Numeric, nullable=True)
    cost_per_unit_gbp = Column(Numeric, nullable=True)
    cost_updated_at = Column(DateTime(timezone=True), nullable=True)

    # Impact
    kg_co2e_per_kg = Column(Numeric, nullable=True)

    # Dietary flags
    is_vegetarian = Column(Boolean, nullable=False, default=True)
    is_vegan = Column(Boolean, nullable=False, default=True)
    contains_gluten = Column(Boolean, nullable=False, default=False)
    contains_dairy = Column(Boolean, nullable=False, default=False)
    contains_nuts = Column(Boolean, nullable=False, default=False)
    contains_egg = Column(Boolean, nullable=False, default=False)
    contains_soy = Column(Boolean, nullable=False, default=False)
    contains_shellfish = Column(Boolean, nullable=False, default=False)

    # Provenance
    source = Column(String, nullable=True)
    data_quality = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
