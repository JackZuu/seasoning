import { apiFetch } from "./client";

export interface LarderItem {
  id: number;
  item: string;
  category: string;
}

export interface LarderRecipeSuggestion {
  title: string;
  description: string;
  key_ingredients: string[];
  missing_ingredients: string[];
}

export async function listLarder(): Promise<LarderItem[]> {
  const res = await apiFetch("/api/larder");
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to load larder");
  return data;
}

export async function addLarderItem(item: string, category: string = "Other"): Promise<LarderItem> {
  const res = await apiFetch("/api/larder", {
    method: "POST",
    body: JSON.stringify({ item, category }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to add item");
  return data;
}

export async function removeLarderItem(id: number): Promise<void> {
  const res = await apiFetch(`/api/larder/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove item");
}

export async function generateRecipesFromLarder(): Promise<LarderRecipeSuggestion[]> {
  const res = await apiFetch("/api/larder/generate-recipes", { method: "POST" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Failed to generate recipes");
  return data.suggestions;
}
