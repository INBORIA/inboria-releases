import { beforeEach, describe, expect, it, vi } from "vitest";

// Test d'integration ciblé pour POST /inboria/chat. On verifie que le
// bloc contact-aware injecte effectivement le bon contexte dans le
// prompt systeme :
//  - contact CONNU (mails recents presents) -> le prompt contient
//    "Contact cible <email>" ET au moins un sujet d'echange recent
//  - contact INCONNU (aucun mail trouve) -> le prompt contient le
//    garde-fou "aucune trace dans la memoire" + "NE PAS INVENTER"
// On capture le system prompt envoye a OpenAI sans appeler le vrai LLM.

vi.setConfig({ testTimeout: 30_000 });

// --- Mocks transverses ---
vi.mock("../services/credits", () => ({
  AI_COST: { inboria_chat: 1 },
  checkEntitlement: vi.fn().mockResolvedValue({ blocked: false }),
  consumeAiCredits: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../lib/inbox-scope", () => ({
  getMemberMailboxIds: vi.fn().mockResolvedValue([]),
  buildInboxScopeOrFilter: vi.fn().mockReturnValue("user_id.eq.user-1"),
}));

vi.mock("../lib/org-admin", () => ({
  getOrgIdForOrgAdmin: vi.fn().mockResolvedValue(null),
  listOrgMemberIds: vi.fn().mockResolvedValue([]),
  logAdminTeamAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../middlewares/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = req.headers["x-test-user"] || "user-1";
    next();
  },
}));

// Capture du system prompt + reponse stub. On laisse "reply" tres court
// pour ne pas polluer les logs.
const completionsCreate = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create: completionsCreate } };
  },
}));

// --- Stub Supabase chainable, override par-table ---
// Par defaut chaque table renvoie {data: [], error: null} sur tout
// terminal (.then / await). Les tests redefinissent le retour des tables
// "emails" et "tasks" pour creer le scenario known/unknown.
let emailsResult: { data: any[]; error: any } = { data: [], error: null };
let tasksResult: { data: any[]; error: any } = { data: [], error: null };

function chain(table: string) {
  const c: any = {
    _table: table,
    _inCalled: false,
    select: () => c,
    eq: () => c,
    neq: () => c,
    in: () => {
      c._inCalled = true;
      return c;
    },
    or: () => c,
    not: () => c,
    is: () => c,
    gte: () => c,
    lte: () => c,
    gt: () => c,
    lt: () => c,
    like: () => c,
    ilike: () => c,
    contains: () => c,
    overlaps: () => c,
    match: () => c,
    filter: () => c,
    order: () => c,
    limit: () => c,
    range: () => c,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (v: any) => any) => {
      if (table === "emails") return resolve(emailsResult);
      // Pour "tasks" on differencie : la requete contact-scoped utilise
      // .in("email_id", ids) (donc _inCalled=true), la requete globale
      // de memoire ne l'utilise pas. On ne renvoie tasksResult que pour
      // la version contact-scoped, sinon on retourne vide pour eviter
      // de polluer le scenario unknown.
      if (table === "tasks") return resolve(c._inCalled ? tasksResult : { data: [], error: null });
      return resolve({ data: [], error: null });
    },
  };
  return c;
}

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: (t: string) => chain(t) },
}));

async function callChat(messages: Array<{ role: string; content: string }>) {
  const express = (await import("express")).default;
  const router = (await import("./inboria-context")).default;
  const app = express();
  app.use(express.json());
  // Le handler utilise req.log.error/warn/debug (pino). On stub avec un
  // logger no-op qui imprime les erreurs sur stderr pour le debug, sans
  // jamais faire planter le handler.
  app.use((req: any, _res, next) => {
    req.log = {
      error: (...a: any[]) =>
        process.stderr.write(`[req.log.error] ${JSON.stringify(a)}\n`),
      warn: (...a: any[]) =>
        process.stderr.write(`[req.log.warn] ${JSON.stringify(a)}\n`),
      debug: () => {},
      info: () => {},
    };
    next();
  });
  app.use(router);
  app.use((err: any, _req: any, res: any, _next: any) => {
    process.stderr.write(`[express err handler] ${err?.stack || err}\n`);
    if (!res.headersSent) res.status(500).json({ error: String(err?.message || err) });
  });

  const { default: request } = await import("supertest").catch(
    () => ({ default: null as any }),
  );
  if (request) {
    const r = await request(app)
      .post("/inboria/chat")
      .set("x-test-user", "user-1")
      .send({ messages });
    return { status: r.status, json: r.body };
  }
  return await new Promise<{ status: number; json: any }>((resolve) => {
    const server = app.listen(0, async () => {
      const port = (server.address() as any).port;
      const r = await fetch(`http://127.0.0.1:${port}/inboria/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-user": "user-1" },
        body: JSON.stringify({ messages }),
      });
      const json = await r.json().catch(() => ({}));
      server.close();
      resolve({ status: r.status, json });
    });
  });
}

function getSystemPrompt(): string {
  expect(completionsCreate).toHaveBeenCalled();
  const args = completionsCreate.mock.calls[0]![0]!;
  const sys = (args.messages || []).find((m: any) => m.role === "system");
  expect(sys, "no system message captured").toBeTruthy();
  return String(sys.content);
}

describe("POST /inboria/chat — contact-aware grounding", () => {
  beforeEach(() => {
    completionsCreate.mockReset();
    completionsCreate.mockResolvedValue({
      choices: [{ message: { content: "Réponse stub." } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    emailsResult = { data: [], error: null };
    tasksResult = { data: [], error: null };
  });

  it("known contact: injects contact context AND scoped tasks into the system prompt", async () => {
    const target = "alice@acme.com";
    emailsResult = {
      data: [
        {
          id: 1,
          sender: `Alice <${target}>`,
          recipient: "user-1@startup.fr",
          subject: "Devis ERP Q3",
          summary: "Demande devis pour migration ERP",
          sent_at: null,
          created_at: "2026-04-20T10:00:00Z",
          is_private: false,
        },
      ],
      error: null,
    };
    // Tache scopee contact (liee a email_id=1 du mail ci-dessus). Doit
    // apparaitre dans la section "Taches liees a <email>" du prompt.
    tasksResult = {
      data: [
        {
          title: "Envoyer devis migration ERP a Alice",
          due_date: "2026-05-10",
          done: false,
        },
      ],
      error: null,
    };

    const res = await callChat([
      { role: "user", content: `Raconte-moi ce qu'on a echange avec ${target}` },
    ]);

    expect(res.status).toBe(200);
    expect(res.json.reply).toContain("Réponse stub.");
    const sys = getSystemPrompt();
    expect(sys).toContain("Contact cible");
    expect(sys.toLowerCase()).toContain(target);
    expect(sys).toContain("Devis ERP Q3");
    expect(sys).toContain(`Taches liees a ${target}`);
    expect(sys).toContain("Envoyer devis migration ERP a Alice");
    expect(sys).toContain("2026-05-10");
  });

  it("unknown contact: injects 'aucune trace' guard AND no tasks section", async () => {
    const target = "ghost@unknown.io";
    emailsResult = { data: [], error: null };
    // Meme si la table tasks renverrait des lignes par erreur, le bloc
    // contact-aware ne doit PAS injecter de section "Taches liees" si
    // aucun mail recent ne matche le contact (court-circuite avant la
    // requete tasks).
    tasksResult = {
      data: [{ title: "ne doit jamais apparaitre", due_date: null, done: false }],
      error: null,
    };

    const res = await callChat([
      { role: "user", content: `Que sait-on de ${target} ?` },
    ]);

    expect(res.status).toBe(200);
    const sys = getSystemPrompt();
    expect(sys.toLowerCase()).toContain(target);
    expect(sys).toContain("aucune trace dans la memoire");
    expect(sys).toContain("NE PAS INVENTER");
    expect(sys).not.toContain(`Taches liees a ${target}`);
    expect(sys).not.toContain("ne doit jamais apparaitre");
  });
});
