import { describe, it, expect, vi, beforeEach } from "vitest";

// 30s per-test timeout: the helper `callRoute` does a dynamic
// `await import("./ai")` which transitively loads heavy modules
// (`openai`, the inboria-prompt builder + Supabase client tree, etc.).
// On cold start this can take 4–6s on its own and occasionally pushes
// past Vitest's 5s default — making the assertion-only tests flake.
vi.setConfig({ testTimeout: 30_000 });

// --- Mocks ---
const credits = {
  checkEntitlement: vi.fn(),
  consumeAiCredits: vi.fn(),
  AI_COST: { draft: 1, daily_summary: 1, summary: 1, classify: 1, prioritize: 1, follow_up: 1 },
};
vi.mock("../services/credits", () => credits);

const recordAutopilotEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("../services/autopilot-events", () => ({ recordAutopilotEvent }));

vi.mock("../services/knowledge-base", () => ({
  getKnowledgeBase: vi.fn().mockResolvedValue(""),
  getSystemPrompt: vi.fn().mockReturnValue(""),
}));

vi.mock("../lib/inbox-scope", () => ({
  getMemberMailboxIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = req.headers["x-test-user"] || "user-1";
    req.headers.authorization = "Bearer test-token";
    next();
  },
}));

let followupRow: any = { id: "f1", email_id: 42, title: "Relance" };
let emailRow: any = {
  id: 42,
  sender: "client@x.com",
  recipient: "client@x.com",
  subject: "Devis",
  body: "<p>Bonjour,</p>",
  created_at: "2026-04-15T10:00:00Z",
};
let followupError: any = null;
let emailError: any = null;

function chain(table: string) {
  const c: any = {
    _table: table,
    select: () => c,
    eq: () => c,
    or: () => c,
    single: async () => {
      if (table === "followups") return { data: followupRow, error: followupError };
      if (table === "emails") return { data: emailRow, error: emailError };
      return { data: null, error: null };
    },
  };
  return c;
}
vi.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: (t: string) => chain(t) },
}));

const completionsCreate = vi.fn();
vi.mock("openai", () => {
  return {
    default: class {
      chat = { completions: { create: completionsCreate } };
    },
  };
});

// --- Helpers ---
async function callRoute(body: any, userId = "user-1"): Promise<{ status: number; json: any }> {
  const express = (await import("express")).default;
  const aiRouter = (await import("./ai")).default;
  const app = express();
  app.use(express.json());
  app.use(aiRouter);

  const { default: request } = await import("supertest").catch(() => ({ default: null as any }));
  if (request) {
    const r = await request(app).post("/ai/follow-up-draft").set("x-test-user", userId).send(body);
    return { status: r.status, json: r.body };
  }
  // Fallback fetch via http listen
  return await new Promise((resolve) => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      const r = await fetch(`http://127.0.0.1:${port}/ai/follow-up-draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-user": userId },
        body: JSON.stringify(body),
      });
      const json = await r.json().catch(() => ({}));
      server.close();
      resolve({ status: r.status, json });
    });
  });
}

beforeEach(() => {
  credits.checkEntitlement.mockReset();
  credits.consumeAiCredits.mockReset();
  recordAutopilotEvent.mockClear();
  completionsCreate.mockReset();
  followupRow = { id: "f1", email_id: 42, title: "Relance" };
  emailRow = {
    id: 42,
    sender: "client@x.com",
    recipient: "client@x.com",
    subject: "Devis",
    body: "<p>Bonjour,</p>",
    created_at: "2026-04-15T10:00:00Z",
  };
  followupError = null;
  emailError = null;
});

// --- Tests ---
describe("POST /ai/follow-up-draft", () => {
  it("returns 403 when entitlement is blocked", async () => {
    credits.checkEntitlement.mockResolvedValue({ blocked: true, reason: "quota_exceeded" });
    const res = await callRoute({ followupId: "f1" });
    expect(res.status).toBe(403);
    expect(res.json.error).toBe("quota_exceeded");
    expect(completionsCreate).not.toHaveBeenCalled();
  });

  it("returns 400 when followupId is missing", async () => {
    credits.checkEntitlement.mockResolvedValue({ blocked: false });
    const res = await callRoute({});
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/followupId/);
  });

  it("returns 404 when followup is not owned by the caller", async () => {
    credits.checkEntitlement.mockResolvedValue({ blocked: false });
    followupRow = null;
    followupError = { message: "no rows" };
    const res = await callRoute({ followupId: "ghost" });
    expect(res.status).toBe(404);
    expect(res.json.error).toMatch(/introuvable/i);
  });

  it("returns 404 when the linked email cannot be loaded", async () => {
    credits.checkEntitlement.mockResolvedValue({ blocked: false });
    emailRow = null;
    emailError = { message: "no" };
    const res = await callRoute({ followupId: "f1" });
    expect(res.status).toBe(404);
  });

  it("generates a draft, consumes credits, records autopilot, returns subject/to/emailId", async () => {
    credits.checkEntitlement.mockResolvedValue({ blocked: false });
    credits.consumeAiCredits.mockResolvedValue({ ok: true });
    completionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Bonjour, je me permets de revenir vers vous…" } }],
    });
    const res = await callRoute({ followupId: "f1" });
    expect(res.status).toBe(200);
    expect(res.json.draft).toContain("revenir");
    expect(res.json.subject).toBe("Re: Devis");
    expect(res.json.to).toBe("client@x.com");
    expect(res.json.emailId).toBe(42);
    expect(credits.consumeAiCredits).toHaveBeenCalledWith(expect.any(String), "draft");
    expect(recordAutopilotEvent).toHaveBeenCalledTimes(1);
    expect(recordAutopilotEvent.mock.calls[0]![0].eventType).toBe("draft_generated");
  });

  it("does not double-prefix Re: when subject already starts with it", async () => {
    credits.checkEntitlement.mockResolvedValue({ blocked: false });
    credits.consumeAiCredits.mockResolvedValue({ ok: true });
    emailRow.subject = "Re: Devis urgent";
    completionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Petit rappel." } }],
    });
    const res = await callRoute({ followupId: "f1" });
    expect(res.status).toBe(200);
    expect(res.json.subject).toBe("Re: Devis urgent");
  });

  it("returns 500 when billing fails after generation", async () => {
    credits.checkEntitlement.mockResolvedValue({ blocked: false });
    credits.consumeAiCredits.mockResolvedValue({ ok: false });
    completionsCreate.mockResolvedValue({
      choices: [{ message: { content: "..." } }],
    });
    const res = await callRoute({ followupId: "f1" });
    expect(res.status).toBe(500);
    expect(res.json.error).toMatch(/facturation/i);
  });
});
