const API = process.env.NEXT_PUBLIC_API_URL ?? "https://ia-edu-rag-production.up.railway.app";

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: {} };
  if (body instanceof FormData) {
    opts.body = body;
  } else if (body != null) {
    (opts.headers as Record<string, string>)["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return null as T;
  return res.json() as Promise<T>;
}
