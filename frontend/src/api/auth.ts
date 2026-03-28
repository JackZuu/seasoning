import { apiFetch, safeJson } from "./client";

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
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Signup failed");
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Invalid email or password");
  return data;
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  const res = await apiFetch("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
}

export async function resetPassword(email: string, token: string, newPassword: string): Promise<{ message: string }> {
  const res = await apiFetch("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ email, token, new_password: newPassword }),
  });
  const data = await safeJson(res);
  if (!res.ok) throw new Error(data.detail || "Reset failed");
  return data;
}
