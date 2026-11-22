// export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

// export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
//   const res = await fetch(`/api${path}`, {
//     credentials: "include",
//     headers: { "Content-Type": "application/json" },
//     ...init,
//   });
//   if (!res.ok) {
//     const body = await res.json().catch(() => ({}));
//     throw Object.assign(new Error(body.detail || "Request failed"), { status: res.status });
//   }
//   return res.json() as Promise<T>;
// }

export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    // For file uploads the browser must set its own Content-Type
    headers: isForm ? init.headers : { "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = typeof body.detail === "string" ? body.detail : "Request failed";
    throw Object.assign(new Error(message), { status: res.status });
  }
  return res.json() as Promise<T>;
}