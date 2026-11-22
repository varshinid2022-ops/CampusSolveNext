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
  const contentType = response.headers.get("content-type") || "";
  let data: any = null;
  if (text) {
    if (!contentType.includes("application/json")) {
      throw new Error(
        `API ${response.status}: expected JSON but received ${contentType || "non-JSON"}`
      );
    }
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`API ${response.status}: invalid JSON response`);
    }
  }
  if (!response.ok) throw new Error(data?.detail || `Request failed (${response.status})`);
  return data as T;
}
