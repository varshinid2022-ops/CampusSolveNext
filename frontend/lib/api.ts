export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("campussolve_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const requestUrl = API_URL ? `${API_URL}${path}` : `/api${path}`;
  const response = await fetch(requestUrl, { ...options, headers, cache: "no-store" });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.detail || "Request failed");
  return data as T;
}
