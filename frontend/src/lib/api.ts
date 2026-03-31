import { supabase } from "./supabase";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
    ...(await authHeaders()),
    ...(init.headers as Record<string, string>),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// For multipart/form-data uploads — no Content-Type header so the browser sets the boundary
async function requestForm<T>(path: string, body: FormData): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  postForm: <T>(path: string, body: FormData) => requestForm<T>(path, body),
  delete: async (path: string): Promise<void> => {
    const headers = {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    };
    const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers });
    if (!res.ok) {
      if (res.status === 401) throw new Error("Unauthorized");
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "Request failed");
    }
  },
};
