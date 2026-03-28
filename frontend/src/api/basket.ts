import { apiFetch, safeJson } from "./client";
import type { Ingredient } from "./recipes";

export interface BasketItem {
  id: number;
  item: string;
  category: string;
  quantity: string | null;
  checked: boolean;
  recipe_id: number | null;
}

export async function listBasket(): Promise<BasketItem[]> {
  const res = await apiFetch("/api/basket");
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to load basket");
  return data;
}

export async function addToBasket(item: string, category: string = "Other", quantity?: string): Promise<BasketItem> {
  const res = await apiFetch("/api/basket", {
    method: "POST",
    body: JSON.stringify({ item, category, quantity }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to add item");
  return data;
}

export async function addRecipeToBasket(recipeId: number, ingredients: Ingredient[]): Promise<void> {
  const res = await apiFetch("/api/basket/from-recipe", {
    method: "POST",
    body: JSON.stringify({ recipe_id: recipeId, ingredients }),
  });
  if (!res.ok) throw new Error("Failed to add recipe to basket");
}

export async function toggleCheck(id: number): Promise<boolean> {
  const res = await apiFetch(`/api/basket/${id}/check`, { method: "PATCH" });
  const data = await safeJson(res);
  return data.checked;
}

export async function removeFromBasket(id: number): Promise<void> {
  const res = await apiFetch(`/api/basket/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove item");
}

export async function clearCompleted(): Promise<void> {
  const res = await apiFetch("/api/basket/clear/completed", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear completed");
}

export async function clearBasket(): Promise<void> {
  const res = await apiFetch("/api/basket/clear/all", { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear basket");
}
