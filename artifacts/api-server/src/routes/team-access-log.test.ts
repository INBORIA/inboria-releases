import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

interface LogRow {
  id: number;
  organisation_id: string;
  admin_user_id: string;
  target_user_id: string | null;
  target_type: string;
  target_value: string | null;
  emails_seen_count: number;
  action: string;
  created_at: string;
}
interface ConnRow {
  user_id: string;
  email_address: string;
}
interface ProfileRow {
  id: string;
  full_name?: string;
  email?: string;
}

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    const headerVal = req.headers["x-test-user"];
    const uid = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    (req as Request & { userId?: string }).userId = uid || "user-1";
    next();
  },
}));

let mockOrgAdminFor: Record<string, string | null> = {};
let mockOrgMemberFor: Record<string, string | null> = {};
vi.mock("../lib/org-admin", () => ({
  getOrgIdForOrgAdmin: vi.fn(async (uid: string) => mockOrgAdminFor[uid] ?? null),
  getOrgIdForMember: vi.fn(async (uid: string) => mockOrgMemberFor[uid] ?? null),
}));

let logRows: LogRow[] = [];
let connectionRows: ConnRow[] = [];
let profileRows: ProfileRow[] = [];

interface ChainResult {
  data: unknown[];
  error: null;
}
interface QueryChain {
  _filters: Record<string, unknown>;
  select: () => QueryChain;
  eq: (col: string, val: unknown) => QueryChain;
  in: (col: string, vals: unknown[]) => QueryChain;
  order: () => QueryChain;
  limit: () => QueryChain;
  then: (resolve: (r: ChainResult) => void) => Promise<void>;
}

function chain(table: string): QueryChain {
  const c: QueryChain = {
    _filters: {},
    select: () => c,
    eq: (col, val) => {
      c._filters[col] = val;
      return c;
    },
    in: (col, vals) => {
      c._filters[`${col}__in`] = vals;
      return c;
    },
    order: () => c,
    limit: () => c,
    then: (resolve) => {
      let data: unknown[] = [];
      if (table === "admin_team_access_log") {
        data = logRows.filter((r) => {
          if (c._filters.organisation_id && r.organisation_id !== c._filters.organisation_id) {
            return false;
          }
          return true;
        });
      } else if (table === "email_connections") {
        data = connectionRows.filter((r) =>
          !c._filters.user_id || r.user_id === c._filters.user_id,
        );
      } else if (table === "profiles") {
        const ids = c._filters.id__in as string[] | undefined;
        data = profileRows.filter((p) => !ids || ids.includes(p.id));
      }
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
  return c;
}

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: (t: string) => chain(t) },
}));

interface CallResult {
  status: number;
  json: { scope?: string; entries?: Array<Record<string, unknown>>; error?: string };
}

async function call(path: string, userId = "user-1"): Promise<CallResult> {
  const express = (await import("express")).default;
  const router = (await import("./team-access-log")).default;
  const app = express();
  app.use(express.json());
  app.use(router);
  return await new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      const port = addr && typeof addr === "object" ? addr.port : 0;
      const r = await fetch(`http://127.0.0.1:${port}${path}`, {
        headers: { "x-test-user": userId },
      });
      const json = (await r.json().catch(() => ({}))) as CallResult["json"];
      server.close();
      resolve({ status: r.status, json });
    });
  });
}

beforeEach(() => {
  mockOrgAdminFor = {};
  mockOrgMemberFor = {};
  logRows = [];
  connectionRows = [];
  profileRows = [];
});

describe("GET /admin/team-access-log?scope=org", () => {
  it("returns 403 for a non-admin caller", async () => {
    mockOrgAdminFor = { "user-1": null };
    logRows = [
      { id: 1, organisation_id: "org-A", admin_user_id: "admin-1", target_user_id: "member-2", target_type: "contact", target_value: "bob@x.com", emails_seen_count: 3, action: "view", created_at: "2026-04-20T10:00:00Z" },
    ];
    const res = await call("/admin/team-access-log?scope=org", "user-1");
    expect(res.status).toBe(403);
  });

  it("returns 200 for an org admin and only includes rows of that admin's organisation", async () => {
    mockOrgAdminFor = { "admin-A": "org-A" };
    logRows = [
      { id: 1, organisation_id: "org-A", admin_user_id: "admin-A", target_user_id: "member-A1", target_type: "contact", target_value: "client@a.com", emails_seen_count: 2, action: "view", created_at: "2026-04-20T10:00:00Z" },
      { id: 2, organisation_id: "org-B", admin_user_id: "admin-B", target_user_id: "member-B1", target_type: "contact", target_value: "client@b.com", emails_seen_count: 5, action: "view", created_at: "2026-04-21T10:00:00Z" },
    ];
    profileRows = [
      { id: "admin-A", full_name: "Admin Alpha", email: "admin@a.com" },
      { id: "member-A1", full_name: "Member A1", email: "m1@a.com" },
    ];
    const res = await call("/admin/team-access-log?scope=org", "admin-A");
    expect(res.status).toBe(200);
    expect(res.json.scope).toBe("org");
    expect(res.json.entries).toHaveLength(1);
    const e = (res.json.entries ?? [])[0];
    expect(e.id).toBe(1);
    expect(e.adminName).toBe("Admin Alpha");
    expect(e.adminEmail).toBe("admin@a.com");
    expect(e.targetUserId).toBe("member-A1");
    expect(e.targetName).toBe("Member A1");
    expect(e.targetEmail).toBe("m1@a.com");
  });
});

describe("GET /admin/team-access-log?scope=mine (default)", () => {
  it("returns empty entries when the caller is in no organisation", async () => {
    mockOrgMemberFor = { "user-1": null };
    const res = await call("/admin/team-access-log");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ scope: "mine", entries: [] });
  });

  it("returns rows where target_user_id matches the caller (strict pivot)", async () => {
    mockOrgMemberFor = { "member-2": "org-A" };
    connectionRows = [{ user_id: "member-2", email_address: "m2@x.com" }];
    logRows = [
      { id: 10, organisation_id: "org-A", admin_user_id: "admin-1", target_user_id: "member-2", target_type: "member_inbox", target_value: "m2@x.com", emails_seen_count: 4, action: "view_inboria_team", created_at: "2026-04-20T10:00:00Z" },
      { id: 11, organisation_id: "org-A", admin_user_id: "admin-1", target_user_id: "member-3", target_type: "member_inbox", target_value: "m3@x.com", emails_seen_count: 1, action: "view_inboria_team", created_at: "2026-04-21T10:00:00Z" },
      { id: 12, organisation_id: "org-A", admin_user_id: "admin-1", target_user_id: null, target_type: "inbox_overview", target_value: null, emails_seen_count: 50, action: "view", created_at: "2026-04-22T10:00:00Z" },
    ];
    profileRows = [{ id: "admin-1", full_name: "Admin One" }];
    const res = await call("/admin/team-access-log", "member-2");
    expect(res.status).toBe(200);
    expect(res.json.scope).toBe("mine");
    const ids = (res.json.entries ?? []).map((e) => e.id);
    expect(ids).toContain(10);
    expect(ids).not.toContain(11);
    expect(ids).not.toContain(12);
    expect((res.json.entries ?? [])[0].adminName).toBe("Admin One");
  });

  it("legacy fallback: rows written before target_user_id existed are matched by target_value === my email", async () => {
    mockOrgMemberFor = { "member-2": "org-A" };
    connectionRows = [{ user_id: "member-2", email_address: "m2@x.com" }];
    logRows = [
      { id: 20, organisation_id: "org-A", admin_user_id: "admin-1", target_user_id: null, target_type: "member_inbox", target_value: "m2@x.com", emails_seen_count: 7, action: "view_inboria_team", created_at: "2026-04-20T10:00:00Z" },
      { id: 21, organisation_id: "org-A", admin_user_id: "admin-1", target_user_id: null, target_type: "member_inbox", target_value: "m3@x.com", emails_seen_count: 1, action: "view_inboria_team", created_at: "2026-04-21T10:00:00Z" },
    ];
    profileRows = [{ id: "admin-1", full_name: "Admin One" }];
    const res = await call("/admin/team-access-log", "member-2");
    expect(res.status).toBe(200);
    const ids = (res.json.entries ?? []).map((e) => e.id);
    expect(ids).toContain(20);
    expect(ids).not.toContain(21);
  });

  it("does not leak rows from another organisation (org filter applied via org membership)", async () => {
    mockOrgMemberFor = { "member-2": "org-A" };
    connectionRows = [{ user_id: "member-2", email_address: "m2@x.com" }];
    logRows = [
      { id: 30, organisation_id: "org-A", admin_user_id: "admin-A", target_user_id: "member-2", target_type: "contact", target_value: "client@x.com", emails_seen_count: 1, action: "view", created_at: "2026-04-20T10:00:00Z" },
      { id: 31, organisation_id: "org-B", admin_user_id: "admin-B", target_user_id: "member-2", target_type: "contact", target_value: "m2@x.com", emails_seen_count: 99, action: "view", created_at: "2026-04-21T10:00:00Z" },
    ];
    profileRows = [{ id: "admin-A", full_name: "Admin A" }];
    const res = await call("/admin/team-access-log", "member-2");
    expect(res.status).toBe(200);
    const ids = (res.json.entries ?? []).map((e) => e.id);
    expect(ids).toContain(30);
    expect(ids).not.toContain(31);
  });
});
