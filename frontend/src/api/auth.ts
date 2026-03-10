import { apiFetch } from "./client";

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: { id: number; email: string };
}

export async function signup(email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Signup failed");
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Invalid email or password");
  return data;
}
