import { apiFetch, safeJson } from "./client";

export interface IngredientHit {
  id: number;
  canonical_name: string;
  display_name: string | null;
  category: string | null;
  typical_unit_label: string | null;
}

export async function searchIngredients(q: string): Promise<IngredientHit[]> {
  if (!q.trim()) return [];
  const res = await apiFetch(`/api/ingredients/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) return [];
  return safeJson(res);
}

export interface BackfillResult {
  recipes_processed: number;
  ingredients_resolved: number;
  new_ingredients_created: number;
}

export async function backfillIngredients(allowLlm = false): Promise<BackfillResult> {
  const res = await apiFetch(
    `/api/ingredients/backfill?allow_llm=${allowLlm ? "true" : "false"}`,
    { method: "POST" }
  );
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Backfill failed");
  return data;
}
