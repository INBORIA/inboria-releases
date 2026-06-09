import { supabase } from "@/lib/supabase";

// L'app mobile tourne hors du proxy partagé : il faut une URL ABSOLUE.
// EXPO_PUBLIC_DOMAIN est injecté par le workflow (dev) et au build (prod).
// Le proxy partagé route ensuite /api vers l'artifact api-server.
const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const API_BASE = DOMAIN ? `https://${DOMAIN}` : "";

export async function authFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!path.startsWith("http") && !API_BASE) {
    // Fail loud instead of issuing a malformed relative request that would
    // fail opaquely on a native device.
    throw new Error(
      "Configuration manquante : EXPO_PUBLIC_DOMAIN n'est pas défini.",
    );
  }
  const url = path.startsWith("http")
    ? path
    : `${API_BASE}/${path.replace(/^\//, "")}`;
  return fetch(url, { ...init, headers });
}

export async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  if (!res.ok) {
    let message = `Requête échouée (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = String(body.error);
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type EmailPriority = "urgente" | "haute" | "moyenne" | "basse" | string;

export interface EmailListItem {
  id: number;
  sender: string;
  senderEmail: string;
  subject: string;
  summary: string | null;
  priority: EmailPriority | null;
  status: string | null;
  createdAt: string;
  inboriaScore: number | null;
}

export interface EmailListResponse {
  emails: EmailListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  size: number;
}

export interface EmailDetail extends EmailListItem {
  body: string | null;
  attachments: EmailAttachment[];
  handledAt: string | null;
}

export interface ListEmailsParams {
  page?: number;
  limit?: number;
  status?: string;
  sort?: "smart" | "recent";
  q?: string;
}

export function listEmails(
  params: ListEmailsParams = {},
): Promise<EmailListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 30));
  qs.set("status", params.status ?? "inbox");
  qs.set("sort", params.sort ?? "smart");
  if (params.q) qs.set("q", params.q);
  return authJson<EmailListResponse>(`/api/emails?${qs.toString()}`);
}

export function getEmail(id: number | string): Promise<EmailDetail> {
  return authJson<EmailDetail>(`/api/emails/${id}`);
}

export function markEmailRead(id: number | string): Promise<unknown> {
  return authJson(`/api/emails/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "read" }),
  });
}

export interface SendReplyInput {
  to: string;
  subject: string;
  body: string;
  replyToEmailId?: number;
}

export function sendReply(input: SendReplyInput): Promise<unknown> {
  return authJson(`/api/emails/send`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
