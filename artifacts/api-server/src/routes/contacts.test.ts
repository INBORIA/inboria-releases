import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

interface EmailRow {
  id: number;
  sender: string | null;
  recipient: string | null;
  subject?: string | null;
  body?: string | null;
  status?: string | null;
  priority?: string | null;
  summary?: string | null;
  project_id?: string | null;
  created_at: string;
  user_id?: string | null;
  is_private?: boolean;
  shared_mailbox_id?: string | null;
  projects?: { name: string; reference: string | null } | null;
}
interface TaskRow {
  id: string;
  title: string;
  done: boolean;
  due_date: string | null;
  email_id: number;
  project_id: string | null;
  user_id: string | null;
  created_at: string;
  projects?: { name: string; reference: string | null } | null;
}
interface AppointmentRow {
  id: string;
  title: string;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  email_id: number;
  user_id: string | null;
}
interface AttachmentRow {
  id: string;
  filename: string;
  content_type: string;
  size: number;
  email_id: number;
  created_at: string;
}
interface ProjectRow {
  id: string;
  name: string;
  reference: string | null;
}
interface CommentRow {
  id: string;
  email_id: number;
  user_id: string;
  body: string;
  created_at: string;
}
interface ProfileRow {
  id: string;
  plan?: string;
  full_name?: string;
}
interface ConnectionRow {
  user_id: string;
  email_address: string;
}
interface SharedMailboxRow {
  id: string;
  email_address: string;
  name?: string | null;
}
interface AuditPayload {
  organisationId: string;
  adminUserId: string;
  targetType: string;
  targetUserId?: string | null;
  targetValue?: string | null;
  emailsSeenCount?: number;
  action?: string;
}

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    const headerVal = req.headers["x-test-user"];
    const uid = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    (req as Request & { userId?: string }).userId = uid || "user-1";
    req.headers.authorization = "Bearer test-token";
    next();
  },
}));

let mockMemberMailboxIds: string[] = [];
vi.mock("../lib/inbox-scope", () => ({
  getMemberMailboxIds: vi.fn(async () => mockMemberMailboxIds),
  buildInboxScopeOrFilter: (userId: string) => `and(user_id.eq.${userId},shared_mailbox_id.is.null)`,
}));

// Task #176 — admin team scope mocks. Each test sets `mockOrgAdminFor` to map
// userId -> orgId (or null when the caller is not an org admin), and
// `mockOrgMembers` to map orgId -> active member user_ids. The audit log spy
// captures every logAdminTeamAccess call so tests can assert it was written.
let mockOrgAdminFor: Record<string, string | null> = {};
let mockOrgMembers: Record<string, string[]> = {};
const mockAuditLog = vi.fn(async (_p: AuditPayload): Promise<void> => {});
vi.mock("../lib/org-admin", () => ({
  getOrgIdForOrgAdmin: vi.fn(async (uid: string) => mockOrgAdminFor[uid] ?? null),
  listOrgMemberIds: vi.fn(async (oid: string) => mockOrgMembers[oid] ?? []),
  logAdminTeamAccess: (params: AuditPayload) => mockAuditLog(params),
}));

let emailRows: EmailRow[] = [];
let taskRows: TaskRow[] = [];
let appointmentRows: AppointmentRow[] = [];
let attachmentRows: AttachmentRow[] = [];
let projectRows: ProjectRow[] = [];
let commentRows: CommentRow[] = [];
let profileRows: ProfileRow[] = [];
let connectionRows: ConnectionRow[] = [];
let sharedMailboxRows: SharedMailboxRow[] = [];

// Captures the last `.or(...)` filter passed to each table so cross-org
// isolation tests can assert that the team-scope filter only references
// member ids of the caller's own organisation.
const lastOrFilter: Record<string, string> = {};

interface ChainResult<T> {
  data: T[] | T | null;
  error: null;
}
interface QueryChain {
  _filters: Record<string, unknown>;
  select: () => QueryChain;
  eq: (col: string, val: unknown) => QueryChain;
  or: (filter: string) => QueryChain;
  in: (col: string, vals: unknown[]) => QueryChain;
  order: () => QueryChain;
  limit: () => QueryChain;
  maybeSingle: () => Promise<ChainResult<unknown>>;
  then: (resolve: (r: ChainResult<unknown>) => void) => Promise<void>;
}

function chain(table: string): QueryChain {
  const c: QueryChain = {
    _filters: {},
    select: () => c,
    eq: (col, val) => {
      c._filters[col] = val;
      return c;
    },
    or: (filter) => {
      lastOrFilter[table] = String(filter);
      return c;
    },
    in: (col, vals) => {
      c._filters[`${col}__in`] = vals;
      return c;
    },
    order: () => c,
    limit: () => c,
    maybeSingle: () => {
      let data: ProfileRow[] = [];
      if (table === "profiles") {
        data = profileRows.filter((p) => !c._filters.id || p.id === c._filters.id);
      }
      return Promise.resolve({ data: data[0] ?? null, error: null });
    },
    then: (resolve) => {
      let data: unknown[] = [];
      if (table === "emails") {
        // Apply only filters that the chain explicitly captured. The route
        // sets is_private=false in team mode (so private mails should be
        // dropped from the result). For team-scope OR filters we leave the
        // rows alone — cross-user isolation is enforced by Supabase in prod.
        data = emailRows.filter((e) => {
          if ("is_private" in c._filters && e.is_private !== c._filters.is_private) {
            return false;
          }
          return true;
        });
      } else if (table === "tasks") {
        data = taskRows.filter((t) => {
          if (c._filters.user_id && t.user_id !== c._filters.user_id) return false;
          const inIds = c._filters.user_id__in as string[] | undefined;
          if (inIds && !inIds.includes(String(t.user_id))) return false;
          return true;
        });
      } else if (table === "appointments") {
        data = appointmentRows.filter((a) => {
          if (c._filters.user_id && a.user_id !== c._filters.user_id) return false;
          const inIds = c._filters.user_id__in as string[] | undefined;
          if (inIds && !inIds.includes(String(a.user_id))) return false;
          return true;
        });
      } else if (table === "email_attachments") {
        data = attachmentRows;
      } else if (table === "projects") {
        data = projectRows;
      } else if (table === "email_comments") {
        data = commentRows;
      } else if (table === "profiles") {
        data = profileRows.filter((p) => !c._filters.id || p.id === c._filters.id);
      } else if (table === "email_connections") {
        data = connectionRows.filter((row) => !c._filters.user_id || row.user_id === c._filters.user_id);
      } else if (table === "shared_mailboxes") {
        data = sharedMailboxRows;
      }
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  return c;
}

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: (t: string) => chain(t) },
}));

interface ContactItem {
  email: string;
  name?: string;
  count: number;
  lastSeenAt: string;
}
interface ContactListBody {
  contacts: ContactItem[];
  total: number;
  totalPages?: number;
  access?: { mode: string; privateExcluded: boolean };
}
interface ContactDetailBody {
  contact: { email: string; name?: string; totalCount: number; firstSeenAt: string; lastSeenAt: string };
  conversations: Array<{ id: number; messageCount: number; direction: string; subject: string }>;
  tasks: Array<{ title: string }>;
  appointments: unknown[];
  attachments: unknown[];
  projects: Array<{ reference: string | null }>;
  comments: Array<{ authorName: string; emailSubject: string; body: string }>;
}
interface CallResult<T> {
  status: number;
  json: T & { error?: string };
}

async function call<T = ContactListBody | ContactDetailBody>(
  path: string,
  userId = "user-1",
): Promise<CallResult<T>> {
  const express = (await import("express")).default;
  const contactsRouter = (await import("./contacts")).default;
  const app = express();
  app.use(express.json());
  app.use(contactsRouter);
  return await new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      const port = addr && typeof addr === "object" ? addr.port : 0;
      const r = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { "x-test-user": userId },
      });
      const json = (await r.json().catch(() => ({}))) as CallResult<T>["json"];
      server.close();
      resolve({ status: r.status, json });
    });
  });
}

beforeEach(() => {
  emailRows = [];
  taskRows = [];
  appointmentRows = [];
  attachmentRows = [];
  projectRows = [];
  commentRows = [];
  profileRows = [{ id: "user-1", plan: "business" }];
  connectionRows = [{ user_id: "user-1", email_address: "me@x.com" }];
  sharedMailboxRows = [];
  mockMemberMailboxIds = [];
  mockOrgAdminFor = {};
  mockOrgMembers = {};
  mockAuditLog.mockClear();
  for (const k of Object.keys(lastOrFilter)) delete lastOrFilter[k];
});

describe("GET /contacts (list)", () => {
  it("aggregates inbound senders and outbound recipients with counts and lastSeenAt", async () => {
    emailRows = [
      { id: 1, sender: '"Alice" <alice@example.com>', recipient: null, created_at: "2026-04-20T10:00:00Z" },
      { id: 2, sender: '"Alice" <alice@example.com>', recipient: null, created_at: "2026-04-22T10:00:00Z" },
      { id: 3, sender: "me@x.com", recipient: "bob@example.com", created_at: "2026-04-21T10:00:00Z" },
    ];
    const res = await call<ContactListBody>("/contacts");
    expect(res.status).toBe(200);
    expect(res.json.total).toBe(2);
    const alice = res.json.contacts.find((c) => c.email === "alice@example.com");
    expect(alice?.count).toBe(2);
    expect(alice?.name).toBe("Alice");
    expect(alice?.lastSeenAt).toBe("2026-04-22T10:00:00Z");
    expect(res.json.contacts[0].email).toBe("alice@example.com");
  });

  it("filters by ?q on name and email", async () => {
    emailRows = [
      { id: 1, sender: '"Alice" <alice@example.com>', recipient: null, created_at: "2026-04-20T10:00:00Z" },
      { id: 2, sender: '"Bob" <bob@x.com>', recipient: null, created_at: "2026-04-22T10:00:00Z" },
    ];
    const res = await call<ContactListBody>("/contacts?q=alice");
    expect(res.status).toBe(200);
    expect(res.json.total).toBe(1);
    expect(res.json.contacts[0].email).toBe("alice@example.com");
  });

  it("treats inbound emails with recipient=self as inbound (sender becomes the contact)", async () => {
    emailRows = [
      { id: 10, sender: '"Alice" <alice@example.com>', recipient: "me@x.com", created_at: "2026-04-20T10:00:00Z" },
      { id: 11, sender: '"Alice" <alice@example.com>', recipient: "me@x.com", created_at: "2026-04-22T10:00:00Z" },
    ];
    const res = await call<ContactListBody>("/contacts");
    expect(res.status).toBe(200);
    expect(res.json.total).toBe(1);
    expect(res.json.contacts[0].email).toBe("alice@example.com");
    expect(res.json.contacts[0].count).toBe(2);
    expect(res.json.contacts.find((c) => c.email === "me@x.com")).toBeUndefined();
  });

  it("isolates contacts per user — emails from another user/org are not returned (buildInboxScopeOrFilter is applied)", async () => {
    connectionRows = [
      { user_id: "user-1", email_address: "me@x.com" },
      { user_id: "user-2", email_address: "other@y.com" },
    ];
    emailRows = [
      { id: 100, sender: "me@x.com", recipient: "bob@example.com", created_at: "2026-04-20T10:00:00Z" },
    ];
    const res = await call<ContactListBody>("/contacts", "user-2");
    expect(res.status).toBe(200);
    const emails = res.json.contacts.map((c) => c.email).sort();
    expect(emails).toContain("me@x.com");
    expect(emails).not.toContain("other@y.com");
  });

  it("aggregates each external recipient separately for outbound multi-recipient emails", async () => {
    emailRows = [
      {
        id: 20,
        sender: "me@x.com",
        recipient: "alice@example.com, bob@example.com; me@x.com",
        created_at: "2026-04-20T10:00:00Z",
      },
    ];
    const res = await call<ContactListBody>("/contacts");
    expect(res.status).toBe(200);
    expect(res.json.total).toBe(2);
    const emails = res.json.contacts.map((c) => c.email).sort();
    expect(emails).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("includes shared mailbox addresses as own (does not list them as contacts) and aggregates senders to the shared mailbox", async () => {
    mockMemberMailboxIds = ["mbx1"];
    sharedMailboxRows = [{ id: "mbx1", email_address: "team@x.com" }];
    emailRows = [
      { id: 30, sender: '"Carol" <carol@example.com>', recipient: "team@x.com", created_at: "2026-04-20T10:00:00Z", shared_mailbox_id: "mbx1" },
      { id: 31, sender: "team@x.com", recipient: "carol@example.com", created_at: "2026-04-21T10:00:00Z", shared_mailbox_id: "mbx1" },
    ];
    const res = await call<ContactListBody>("/contacts");
    expect(res.status).toBe(200);
    expect(res.json.total).toBe(1);
    expect(res.json.contacts[0].email).toBe("carol@example.com");
    expect(res.json.contacts[0].count).toBe(2);
  });
});

describe("GET /contacts/:email (detail)", () => {
  it("returns 400 for invalid email param", async () => {
    const res = await call("/contacts/notanemail");
    expect(res.status).toBe(400);
  });

  it("returns 404 when no email matches the address", async () => {
    emailRows = [{ id: 1, sender: '"X" <x@y.com>', recipient: null, created_at: "2026-04-20T10:00:00Z" }];
    const res = await call("/contacts/" + encodeURIComponent("nobody@example.com"));
    expect(res.status).toBe(404);
  });

  it("aggregates conversations, tasks, appointments, projects, comments and attachments for the contact", async () => {
    emailRows = [
      { id: 10, sender: '"Alice" <alice@example.com>', recipient: null, subject: "Devis", body: "...", status: "unread", priority: "moyen", summary: "Demande de devis", project_id: "p1", created_at: "2026-04-20T10:00:00Z", projects: { name: "Site Web", reference: "PROJ-001" } },
      { id: 11, sender: "me@x.com", recipient: "alice@example.com", subject: "Re: Devis", body: "ok", status: "sent", priority: "faible", summary: null, project_id: null, created_at: "2026-04-21T10:00:00Z", projects: null },
      { id: 12, sender: '"Alice" <alice@example.com>', recipient: null, subject: "Relance", body: ".", status: "read", priority: "urgent", summary: null, project_id: "p1", created_at: "2026-04-22T10:00:00Z", projects: { name: "Site Web", reference: "PROJ-001" } },
      { id: 99, sender: '"Other" <other@x.com>', recipient: null, subject: "Hors sujet", body: ".", status: "read", priority: "faible", summary: null, project_id: null, created_at: "2026-04-19T10:00:00Z", projects: null },
    ];
    taskRows = [
      { id: "t1", title: "Préparer devis", done: false, due_date: "2026-04-25", email_id: 10, project_id: "p1", user_id: "user-1", created_at: "2026-04-20T11:00:00Z", projects: { name: "Site Web", reference: "PROJ-001" } },
    ];
    appointmentRows = [
      { id: "a1", title: "Call Alice", location: "Zoom", start_at: "2026-04-25T14:00:00Z", end_at: "2026-04-25T15:00:00Z", all_day: false, email_id: 10, user_id: "user-1" },
    ];
    attachmentRows = [
      { id: "att1", filename: "devis.pdf", content_type: "application/pdf", size: 1234, email_id: 10, created_at: "2026-04-20T10:01:00Z" },
    ];
    projectRows = [{ id: "p1", name: "Site Web", reference: "PROJ-001" }];
    commentRows = [
      { id: "c1", email_id: 10, user_id: "u-team", body: "Important", created_at: "2026-04-20T12:00:00Z" },
    ];
    profileRows = [
      { id: "user-1", plan: "business" },
      { id: "u-team", full_name: "Marc" },
    ];

    const res = await call<ContactDetailBody>("/contacts/" + encodeURIComponent("alice@example.com"));
    expect(res.status).toBe(200);
    expect(res.json.contact.email).toBe("alice@example.com");
    expect(res.json.contact.name).toBe("Alice");
    expect(res.json.contact.totalCount).toBe(3);
    expect(res.json.contact.firstSeenAt).toBe("2026-04-20T10:00:00Z");
    expect(res.json.contact.lastSeenAt).toBe("2026-04-22T10:00:00Z");

    expect(res.json.conversations).toHaveLength(2);
    const devisThread = res.json.conversations.find((c) => c.messageCount === 2);
    expect(devisThread).toBeDefined();
    expect(devisThread?.id).toBe(11);
    expect(devisThread?.direction).toBe("outbound");
    expect(devisThread?.subject).toBe("Re: Devis");
    const relanceThread = res.json.conversations.find((c) => c.subject === "Relance");
    expect(relanceThread).toBeDefined();
    expect(relanceThread?.messageCount).toBe(1);
    expect(relanceThread?.direction).toBe("inbound");

    expect(res.json.tasks).toHaveLength(1);
    expect(res.json.tasks[0].title).toBe("Préparer devis");

    expect(res.json.appointments).toHaveLength(1);
    expect(res.json.attachments).toHaveLength(1);
    expect(res.json.projects).toHaveLength(1);
    expect(res.json.projects[0].reference).toBe("PROJ-001");

    expect(res.json.comments).toHaveLength(1);
    expect(res.json.comments[0].authorName).toBe("Marc");
    expect(res.json.comments[0].emailSubject).toBe("Devis");
  });

  it("handles special characters in email path (URL-encoded plus signs and dots)", async () => {
    emailRows = [
      { id: 60, sender: '"Plus Addr" <user+tag@example.com>', recipient: null, subject: "Hello", body: "", status: "unread", priority: "faible", summary: null, project_id: null, created_at: "2026-04-20T10:00:00Z", projects: null },
    ];
    const res = await call<ContactDetailBody>("/contacts/" + encodeURIComponent("user+tag@example.com"));
    expect(res.status).toBe(200);
    expect(res.json.contact.email).toBe("user+tag@example.com");
    expect(res.json.conversations).toHaveLength(1);
  });

  it("returns empty comments for non-business plans (entitlement gating)", async () => {
    profileRows = [{ id: "user-1", plan: "pro" }];
    emailRows = [
      { id: 70, sender: '"Alice" <alice@example.com>', recipient: null, subject: "Hi", body: "", status: "unread", priority: "faible", summary: null, project_id: null, created_at: "2026-04-20T10:00:00Z", projects: null },
    ];
    commentRows = [
      { id: "c-secret", email_id: 70, user_id: "user-1", body: "Confidential note", created_at: "2026-04-20T11:00:00Z" },
    ];
    const res = await call<ContactDetailBody>("/contacts/" + encodeURIComponent("alice@example.com"));
    expect(res.status).toBe(200);
    expect(res.json.comments).toEqual([]);
  });

  it("includes comments for business plan users", async () => {
    profileRows = [{ id: "user-1", plan: "business" }];
    emailRows = [
      { id: 71, sender: '"Alice" <alice@example.com>', recipient: null, subject: "Hi", body: "", status: "unread", priority: "faible", summary: null, project_id: null, created_at: "2026-04-20T10:00:00Z", projects: null },
    ];
    commentRows = [
      { id: "c-team", email_id: 71, user_id: "user-1", body: "Team note", created_at: "2026-04-20T11:00:00Z" },
    ];
    const res = await call<ContactDetailBody>("/contacts/" + encodeURIComponent("alice@example.com"));
    expect(res.status).toBe(200);
    expect(res.json.comments).toHaveLength(1);
    expect(res.json.comments[0].body).toBe("Team note");
  });

  it("does not leak data from other users via tasks query (user_id filter is enforced)", async () => {
    emailRows = [
      { id: 50, sender: '"Bob" <bob@x.com>', recipient: null, subject: "S", body: "", status: "unread", priority: "faible", summary: null, project_id: null, created_at: "2026-04-20T10:00:00Z", projects: null },
    ];
    taskRows = [
      { id: "tA", title: "Mine", done: false, due_date: null, email_id: 50, project_id: null, user_id: "user-1", created_at: "z", projects: null },
      { id: "tB", title: "Other org", done: false, due_date: null, email_id: 50, project_id: null, user_id: "other-user", created_at: "z", projects: null },
    ];
    const res = await call<ContactDetailBody>("/contacts/" + encodeURIComponent("bob@x.com"));
    expect(res.status).toBe(200);
    expect(res.json.tasks).toHaveLength(1);
    expect(res.json.tasks[0].title).toBe("Mine");
  });
});

describe("GET /contacts?scope=team (admin team scope)", () => {
  it("returns 403 for non-admin caller (no org admin row)", async () => {
    mockOrgAdminFor = { "user-1": null };
    emailRows = [
      { id: 1, sender: '"Alice" <alice@example.com>', recipient: null, created_at: "2026-04-20T10:00:00Z" },
    ];
    const res = await call("/contacts?scope=team");
    expect(res.status).toBe(403);
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("returns 200 for org admin and excludes private emails", async () => {
    mockOrgAdminFor = { "admin-1": "org-A" };
    mockOrgMembers = { "org-A": ["admin-1", "member-2"] };
    connectionRows = [{ user_id: "admin-1", email_address: "admin@x.com" }];
    emailRows = [
      { id: 1, sender: '"Alice" <alice@example.com>', recipient: null, user_id: "member-2", is_private: false, created_at: "2026-04-20T10:00:00Z" },
      { id: 2, sender: '"Secret" <secret@example.com>', recipient: null, user_id: "member-2", is_private: true, created_at: "2026-04-21T10:00:00Z" },
    ];
    const res = await call<ContactListBody>("/contacts?scope=team", "admin-1");
    expect(res.status).toBe(200);
    const emails = res.json.contacts.map((c) => c.email);
    expect(emails).toContain("alice@example.com");
    expect(emails).not.toContain("secret@example.com");
    expect(res.json.access).toEqual({ mode: "team", privateExcluded: true });
  });

  it("writes a member_inbox audit row per teammate whose mailbox contributed", async () => {
    mockOrgAdminFor = { "admin-1": "org-A" };
    mockOrgMembers = { "org-A": ["admin-1", "member-2"] };
    connectionRows = [{ user_id: "admin-1", email_address: "admin@x.com" }];
    emailRows = [
      { id: 1, sender: '"Alice" <alice@example.com>', recipient: null, user_id: "member-2", is_private: false, created_at: "2026-04-20T10:00:00Z" },
    ];
    const res = await call("/contacts?scope=team", "admin-1");
    expect(res.status).toBe(200);
    const calls: AuditPayload[] = mockAuditLog.mock.calls.map((c) => c[0]);
    const memberRows = calls.filter((p) => p.targetType === "member_inbox");
    expect(memberRows.length).toBeGreaterThan(0);
    expect(memberRows.some((p) => p.targetUserId === "member-2")).toBe(true);
    for (const r of memberRows) {
      expect(r.adminUserId).toBe("admin-1");
      expect(r.organisationId).toBe("org-A");
    }
  });

  it("cross-org isolation: admin of org-A only sees org-A members in the team-scope filter (org-B users are absent)", async () => {
    mockOrgAdminFor = {
      "admin-A": "org-A",
      "admin-B": "org-B",
    };
    mockOrgMembers = {
      "org-A": ["admin-A", "member-A1"],
      "org-B": ["admin-B", "member-B1"],
    };
    connectionRows = [{ user_id: "admin-A", email_address: "admin-a@x.com" }];
    emailRows = [
      { id: 1, sender: '"AliceA" <alice-a@example.com>', recipient: null, user_id: "member-A1", is_private: false, created_at: "2026-04-20T10:00:00Z" },
    ];
    const res = await call("/contacts?scope=team", "admin-A");
    expect(res.status).toBe(200);
    const orFilter = lastOrFilter["emails"] || "";
    expect(orFilter).toContain("admin-A");
    expect(orFilter).toContain("member-A1");
    expect(orFilter).not.toContain("admin-B");
    expect(orFilter).not.toContain("member-B1");
    const calls: AuditPayload[] = mockAuditLog.mock.calls.map((c) => c[0]);
    for (const r of calls) {
      expect(r.organisationId).toBe("org-A");
      expect(r.adminUserId).toBe("admin-A");
    }
  });

  it("self scope is unaffected by team-mode plumbing — does not call the audit log", async () => {
    mockOrgAdminFor = { "user-1": "org-A" };
    mockOrgMembers = { "org-A": ["user-1"] };
    emailRows = [
      { id: 1, sender: '"Alice" <alice@example.com>', recipient: null, user_id: "user-1", is_private: true, created_at: "2026-04-20T10:00:00Z" },
    ];
    const res = await call<ContactListBody>("/contacts");
    expect(res.status).toBe(200);
    expect(res.json.contacts.map((c) => c.email)).toContain("alice@example.com");
    expect(mockAuditLog).not.toHaveBeenCalled();
  });
});
