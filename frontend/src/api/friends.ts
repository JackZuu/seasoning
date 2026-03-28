import { apiFetch, safeJson } from "./client";
import type { RecipeListItem } from "./recipes";

export interface FriendSearchResult {
  id: number;
  display_name: string;
}

export interface Invite {
  id: number;
  from_user: FriendSearchResult;
  created_at: string;
}

export async function searchUsers(q: string): Promise<FriendSearchResult[]> {
  const res = await apiFetch(`/api/friends/search?q=${encodeURIComponent(q)}`);
  const data = await safeJson(res);
  if (!res.ok) return [];
  return data;
}

export async function sendInvite(userId: number): Promise<void> {
  const res = await apiFetch(`/api/friends/invite/${userId}`, { method: "POST" });
  if (!res.ok) {
    const data = await safeJson(res);
    throw new Error(data.detail || "Failed to send invite");
  }
}

export async function getInvites(): Promise<Invite[]> {
  const res = await apiFetch("/api/friends/invites");
  const data = await safeJson(res);
  if (!res.ok) return [];
  return data;
}

export async function acceptInvite(friendshipId: number): Promise<void> {
  const res = await apiFetch(`/api/friends/accept/${friendshipId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to accept invite");
}

export async function declineInvite(friendshipId: number): Promise<void> {
  const res = await apiFetch(`/api/friends/decline/${friendshipId}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to decline invite");
}

export async function listFriends(): Promise<FriendSearchResult[]> {
  const res = await apiFetch("/api/friends");
  const data = await safeJson(res);
  if (!res.ok) return [];
  return data;
}

export async function getFriendRecipes(friendId: number): Promise<RecipeListItem[]> {
  const res = await apiFetch(`/api/friends/${friendId}/recipes`);
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to load recipes");
  return data;
}

export async function copyRecipe(recipeId: number): Promise<any> {
  const res = await apiFetch(`/api/recipes/${recipeId}/copy`, { method: "POST" });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Failed to copy recipe");
  return data;
}
