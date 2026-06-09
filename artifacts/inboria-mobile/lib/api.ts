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

// Valeurs de priorité réellement stockées côté backend (cf. emails.ts /
// triage IA) : urgent | moyen | faible. Ne JAMAIS filtrer sur d'autres
// libellés (urgente/haute/normale…) sinon la liste revient vide.
export type EmailPriority = "urgent" | "moyen" | "faible" | string;

export interface EmailListItem {
  id: number;
  sender: string;
  senderEmail: string;
  subject: string;
  summary: string | null;
  priority: EmailPriority | null;
  status: string | null;
  categoryId: number | null;
  categoryName: string | null;
  attachmentCount: number;
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

export interface Category {
  id: number;
  name: string;
  emailCount: number;
  isSystem: boolean;
}

export interface ListEmailsParams {
  page?: number;
  limit?: number;
  status?: string;
  sort?: "smart" | "recent";
  q?: string;
  priority?: "urgent" | "moyen" | "faible";
  categoryId?: number;
}

export function listEmails(
  params: ListEmailsParams = {},
): Promise<EmailListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 40));
  // The inbox is the server's DEFAULT view (no status filter → it excludes
  // archived/trashed/spam/sent/scheduled). Sending status=inbox would do an
  // exact match `.eq("status","inbox")`, which matches no email → empty list.
  // So only forward a real status (read/unread/archived…), never "inbox".
  if (params.status && params.status !== "inbox") {
    qs.set("status", params.status);
  }
  // Par défaut on trie par date (Récents), comme une boîte mail classique.
  qs.set("sort", params.sort ?? "recent");
  if (params.q) qs.set("q", params.q);
  if (params.priority) qs.set("priority", params.priority);
  if (params.categoryId != null) qs.set("categoryId", String(params.categoryId));
  return authJson<EmailListResponse>(`/api/emails?${qs.toString()}`);
}

export function listCategories(): Promise<Category[]> {
  return authJson<Category[]>(`/api/categories`);
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
