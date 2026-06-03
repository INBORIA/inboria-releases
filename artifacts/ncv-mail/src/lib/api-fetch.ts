import { supabase } from "@/lib/supabase";

// Helper d'appel API authentifié réutilisable. Préfixe le chemin avec la base
// de l'artifact (import.meta.env.BASE_URL, qui se termine par "/") et ajoute le
// jeton Bearer Supabase. Modèle repris de export-utils.ts.
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const base = import.meta.env.BASE_URL;
  const url = path.startsWith("http") ? path : `${base}${path.replace(/^\//, "")}`;
  return fetch(url, { ...init, headers });
}

export async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  if (!res.ok) {
    throw new Error(`Requête échouée (${res.status})`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
