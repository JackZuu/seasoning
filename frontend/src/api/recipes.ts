import { apiFetch, safeJson } from "./client";

export interface Ingredient {
  quantity: number | null;
  unit: string | null;
  unit_system: "us_customary" | "metric";
  item: string;
  preparation: string;
  notes: string;
}

export interface InstructionStep {
  step: number;
  text: string;
  duration_minutes: number | null;
  technique_tags: string[];
}

export interface Recipe {
  id: number;
  user_id: number;
  title: string;
  servings: number | null;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  image_url: string | null;
  notes: string;
  created_at: string;
}

export interface RecipeListItem {
  id: number;
  title: string;
  servings: number | null;
  ingredient_count: number;
  image_url: string | null;
  created_at: string;
}

export interface TransformResponse {
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  reasoning: Record<string, string>;
}

export interface SubstitutionResponse {
  original: string;
  substitute: string;
  reasoning: string;
}

export interface NutritionPerServing {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  saturated_fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

export interface NutritionResponse {
  servings: number;
  per_serving: NutritionPerServing;
}

export interface CostResponse {
  total: number;
  per_serving: number;
  currency: string;
  breakdown: { item: string; estimated_cost: number }[];
}

// ─── Parse ───────────────────────────────────────────────────────────────────

export async function parseRecipe(rawText: string): Promise<Recipe> {
  const res = await apiFetch("/api/recipes/parse", {
    method: "POST",
    body: JSON.stringify({ raw_text: rawText }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to parse recipe");
  return data;
}

export async function generateRecipe(title: string, description: string, ingredients: string[]): Promise<Recipe> {
  const res = await apiFetch("/api/recipes/generate", {
    method: "POST",
    body: JSON.stringify({ title, description, ingredients }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to generate recipe");
  return data;
}

export async function parseRecipeFromImage(files: File[]): Promise<Recipe> {
  const formData = new FormData();
  files.forEach(f => formData.append("images", f));

  const res = await apiFetch("/api/recipes/parse-image", {
    method: "POST",
    body: formData,
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to parse image");
  return data;
}

export async function parseRecipeFromURL(url: string): Promise<Recipe> {
  const res = await apiFetch("/api/recipes/parse-url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to parse URL");
  return data;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listRecipes(): Promise<RecipeListItem[]> {
  const res = await apiFetch("/api/recipes");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to load recipes");
  return data;
}

export async function getRecipe(id: number): Promise<Recipe> {
  const res = await apiFetch(`/api/recipes/${id}`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Recipe not found");
  return data;
}

export async function deleteRecipe(id: number): Promise<void> {
  const res = await apiFetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(data.detail || "Failed to delete recipe");
  }
}

export async function updateNotes(id: number, notes: string): Promise<Recipe> {
  const res = await apiFetch(`/api/recipes/${id}/notes`, {
    method: "PATCH",
    body: JSON.stringify({ notes }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to save notes");
  return data;
}

export async function uploadRecipeImage(id: number, file: File): Promise<Recipe> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await apiFetch(`/api/recipes/${id}/upload-image`, {
    method: "POST",
    body: formData,
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to upload image");
  return data;
}

// ─── Conversion ──────────────────────────────────────────────────────────────

export async function convertRecipe(
  id: number,
  targetSystem: "us_customary" | "metric"
): Promise<Ingredient[]> {
  const res = await apiFetch(`/api/recipes/${id}/convert`, {
    method: "POST",
    body: JSON.stringify({ target_system: targetSystem }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Conversion failed");
  return data.ingredients;
}

// ─── AI Features ─────────────────────────────────────────────────────────────

export async function transformRecipe(
  id: number,
  transformation: string,
  dietaryRequirements: string[] = []
): Promise<TransformResponse> {
  const res = await apiFetch(`/api/recipes/${id}/transform`, {
    method: "POST",
    body: JSON.stringify({ transformation, dietary_requirements: dietaryRequirements }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Transformation failed");
  return data;
}

export async function substituteIngredient(
  id: number,
  ingredientItem: string,
  recipeTitle: string,
  dietaryRequirements: string[] = []
): Promise<SubstitutionResponse> {
  const res = await apiFetch(`/api/recipes/${id}/substitute`, {
    method: "POST",
    body: JSON.stringify({
      ingredient_item: ingredientItem,
      recipe_title: recipeTitle,
      dietary_requirements: dietaryRequirements,
    }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Substitution failed");
  return data;
}

export async function getNutrition(id: number): Promise<NutritionResponse> {
  const res = await apiFetch(`/api/recipes/${id}/nutrition`, {
    method: "POST",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Could not get nutrition info");
  return data;
}

export async function estimateCost(id: number): Promise<CostResponse> {
  const res = await apiFetch(`/api/recipes/${id}/cost`, {
    method: "POST",
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Could not estimate cost");
  return data;
}
