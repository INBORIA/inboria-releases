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
  recipient: string | null;
}

// Découpe une chaîne expéditeur brute « Nom <email@x.com> » en { name, email }.
// Certains endpoints (dossiers) renvoient le champ sender non parsé.
export function parseSender(raw: string): { name: string; email: string } {
  const s = (raw || "").trim();
  const m = s.match(/^(.*)<([^>]+)>$/);
  if (m) {
    const email = m[2].trim();
    const name = m[1].trim().replace(/^"|"$/g, "");
    return { name: name || email, email };
  }
  return { name: s, email: s };
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

// --- Composer un nouvel e-mail ---
// Le backend accepte plusieurs destinataires séparés par , ou ; (string).
export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export function sendEmail(input: SendEmailInput): Promise<unknown> {
  return authJson(`/api/emails/send`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// --- Listes par statut (Envoyés / Archives / Corbeille) ---
export function listSent(page = 1): Promise<EmailListResponse> {
  return listEmails({ status: "sent", sort: "recent", limit: 40, page });
}

export function listArchived(page = 1): Promise<EmailListResponse> {
  return listEmails({ status: "archived", sort: "recent", limit: 40, page });
}

export function listTrashed(page = 1): Promise<EmailListResponse> {
  return listEmails({ status: "trashed", sort: "recent", limit: 40, page });
}

// --- Actions sur un e-mail ---
export function archiveEmail(id: number | string): Promise<unknown> {
  return authJson(`/api/emails/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "archived" }),
  });
}

export function trashEmail(id: number | string): Promise<unknown> {
  return authJson(`/api/emails/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "trashed" }),
  });
}

export function restoreEmail(id: number | string): Promise<unknown> {
  return authJson(`/api/emails/${id}/restore`, { method: "POST" });
}

// --- Envois programmés ---
export interface ScheduledEmail {
  id: number;
  subject: string | null;
  to: string | null;
  scheduledSendAt: string | null;
}

export async function listScheduled(): Promise<ScheduledEmail[]> {
  const data = await authJson<any>(`/api/emails/scheduled`);
  const rows = Array.isArray(data) ? data : (data?.emails ?? []);
  return rows.map((e: any) => ({
    id: e.id,
    subject: e.subject ?? null,
    to: e.to ?? e.recipient ?? e.recipientEmail ?? null,
    scheduledSendAt: e.scheduledSendAt ?? e.scheduled_send_at ?? null,
  }));
}

export function cancelScheduled(id: number | string): Promise<unknown> {
  return authJson(`/api/emails/scheduled/${id}`, { method: "DELETE" });
}

// --- Dossiers (Mes dossiers) ---
export interface Folder {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  emailCount: number;
}

export async function listFolders(): Promise<Folder[]> {
  const data = await authJson<any[]>(`/api/folders`);
  return (data ?? []).map((f) => ({
    id: String(f.id),
    name: f.name,
    color: f.color ?? null,
    icon: f.icon ?? null,
    emailCount: f.emailCount ?? 0,
  }));
}

export async function listFolderEmails(
  folderId: string,
  page = 1,
): Promise<EmailListResponse> {
  const qs = new URLSearchParams({ page: String(page), limit: "40" });
  const data = await authJson<any>(
    `/api/folders/${folderId}/emails?${qs.toString()}`,
  );
  // L'endpoint dossiers renvoie `sender` brut (non parsé) et omet senderEmail
  // et attachmentCount → on normalise vers EmailListItem comme les autres listes.
  const emails: EmailListItem[] = (data?.emails ?? []).map((e: any) => {
    const s = parseSender(e.sender || "");
    return {
      id: e.id,
      sender: s.name,
      senderEmail: s.email,
      subject: e.subject,
      summary: e.summary ?? null,
      priority: e.priority ?? null,
      status: e.status ?? null,
      categoryId: e.categoryId ?? null,
      categoryName: e.categoryName ?? null,
      attachmentCount: e.attachmentCount ?? 0,
      createdAt: e.createdAt,
      inboriaScore: e.inboriaScore ?? null,
      recipient: e.recipient ?? null,
    };
  });
  return {
    emails,
    total: data?.total ?? emails.length,
    page: data?.page ?? page,
    totalPages: data?.totalPages ?? 1,
  };
}

// --- Contacts ---
export interface Contact {
  email: string;
  displayName: string;
  lastInteractionAt: string | null;
}

export async function searchContacts(q: string): Promise<Contact[]> {
  const qs = new URLSearchParams({ q, limit: "50" });
  const data = await authJson<any>(`/api/contacts/search?${qs.toString()}`);
  const rows = Array.isArray(data) ? data : (data?.contacts ?? []);
  return rows.map((c: any) => ({
    email: c.email,
    displayName: c.displayName ?? c.display_name ?? c.email,
    lastInteractionAt: c.lastInteractionAt ?? c.last_interaction_at ?? null,
  }));
}

// --- Profil ---
export interface Profile {
  id: string;
  email: string;
  fullName: string;
  plan: string;
  aiLanguage: string;
  timezone: string;
}

export function getProfile(): Promise<Profile> {
  return authJson<Profile>(`/api/profile`);
}
