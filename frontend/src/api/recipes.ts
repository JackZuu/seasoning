import { apiFetch } from "./client";

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
  created_at: string;
}

export interface RecipeListItem {
  id: number;
  title: string;
  servings: number | null;
  ingredient_count: number;
  created_at: string;
}

export async function parseRecipe(rawText: string): Promise<Recipe> {
  const res = await apiFetch("/api/recipes/parse", {
    method: "POST",
    body: JSON.stringify({ raw_text: rawText }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to parse recipe");
  return data;
}

export async function listRecipes(): Promise<RecipeListItem[]> {
  const res = await apiFetch("/api/recipes");
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to load recipes");
  return data;
}

export async function getRecipe(id: number): Promise<Recipe> {
  const res = await apiFetch(`/api/recipes/${id}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Recipe not found");
  return data;
}

export async function deleteRecipe(id: number): Promise<void> {
  const res = await apiFetch(`/api/recipes/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to delete recipe");
  }
}

export async function convertRecipe(
  id: number,
  targetSystem: "us_customary" | "metric"
): Promise<Ingredient[]> {
  const res = await apiFetch(`/api/recipes/${id}/convert`, {
    method: "POST",
    body: JSON.stringify({ target_system: targetSystem }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Conversion failed");
  return data.ingredients;
}
