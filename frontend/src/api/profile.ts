import { apiFetch, safeJson } from "./client";
import type { User } from "../context/AuthContext";

export async function updateProfile(data: {
  display_name?: string;
  recipe_book_name?: string;
  currency?: string;
  preferences?: Record<string, any>;
}): Promise<User> {
  const res = await apiFetch("/api/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  const result = await safeJson(res);
  if (!res.ok) throw new Error(result.detail || "Failed to update profile");
  return result;
}
