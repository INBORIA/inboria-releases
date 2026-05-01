import { beforeEach, describe, expect, it, vi } from "vitest";

// On mocke supabaseAdmin AVANT d'importer processEmail (qui referme dessus
// au moment du module load).
const insertFacts = vi.fn(() => Promise.resolve({ error: null }));
const insertEpisodes = vi.fn(() => Promise.resolve({ error: null }));
const insertSignals = vi.fn(() => Promise.resolve({ error: null }));
const updateEmails = vi.fn(() => ({
  eq: () => Promise.resolve({ error: null }),
}));

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      if (table === "inboria_facts") return { insert: insertFacts };
      if (table === "inboria_episodes") return { insert: insertEpisodes };
      if (table === "inboria_signals") return { insert: insertSignals };
      if (table === "emails") return { update: updateEmails };
      if (table === "profiles") {
        // userExists: .select("id").eq("id", userId).maybeSingle()
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "u1" }, error: null }),
            }),
          }),
        };
      }
      if (table === "email_connections") {
        // isMailboxInboriaEnabled (perso): .select("inboria_enabled").eq("user_id", uid)
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [{ inboria_enabled: true }],
              error: null,
            }),
          }),
        };
      }
      // table inattendue : on echoue explicitement pour eviter qu'un insert
      // sur une autre table inboria_* passe sous le radar.
      throw new Error(`unexpected supabase table in test: ${table}`);
    }),
  },
}));

import { isNoiseEmail, NOISE_SENDER_REGEX } from "./auto-sync";
import { processEmail } from "./inboria-extractor";

// Garde-fou anti-pollution memoire Inboria :
// processEmail() (inboria-extractor.ts) court-circuite via isNoiseEmail() AVANT
// tout appel a OpenAI / tout insert dans inboria_facts/episodes/signals.
// On teste donc que les expediteurs typiquement automatiques sont bien
// classes "noise", ce qui prouve par construction que 0 fact / 0 episode /
// 0 signal ne sera ecrit pour ces sources.
describe("inboria-extractor noise sender guard", () => {
  const NOISE_SENDERS = [
    "noreply@stripe.com",
    "no-reply@github.com",
    "no.reply@dropbox.com",
    "donotreply@bank.com",
    "do-not-reply@airbnb.com",
    "notifications@slack.com",
    "notification@linkedin.com",
    "mailer-daemon@example.com",
    "postmaster@example.com",
    "automated@news.com",
    "alerts@monitoring.io",
    "alert@datadog.com",
    "info-noreply@trello.com",
    '"Stripe" <noreply@stripe.com>',
    "Pretty Name <notifications@github.com>",
  ];

  const HUMAN_SENDERS = [
    "michel.dupont@acme.com",
    "camille@startup.fr",
    "Camille Martin <camille@startup.fr>",
    "support@inboria.com",
    "contact@xchangesuite.com",
    "j.tremblay@cabinet.qc.ca",
  ];

  it("classifies typical automated senders as noise", () => {
    for (const s of NOISE_SENDERS) {
      expect(isNoiseEmail(s, "Hello there")).toBe(true);
    }
  });

  it("does not classify regular human senders as noise", () => {
    for (const s of HUMAN_SENDERS) {
      expect(isNoiseEmail(s, "Question contrat 2026")).toBe(false);
    }
  });

  it("classifies verification/welcome subjects as noise even with neutral senders", () => {
    expect(isNoiseEmail("hello@brand.com", "Confirm your email")).toBe(true);
    expect(isNoiseEmail("hello@brand.com", "Your verification code is 123456")).toBe(true);
    expect(isNoiseEmail("hello@brand.com", "Welcome to Acme")).toBe(true);
    expect(isNoiseEmail("hello@brand.com", "Reset password")).toBe(true);
  });

  it("does not match legitimate French business subjects", () => {
    expect(isNoiseEmail("client@acme.fr", "Devis pour le projet ERP")).toBe(false);
    expect(isNoiseEmail("client@acme.fr", "Confirmation de la livraison de mardi")).toBe(false);
    expect(isNoiseEmail("client@acme.fr", "RDV vendredi 14h")).toBe(false);
  });

  it("exposes a usable shared regex for SQL purge migrations", () => {
    expect(NOISE_SENDER_REGEX.test("noreply@x.com")).toBe(true);
    expect(NOISE_SENDER_REGEX.test("alex@acme.com")).toBe(false);
  });
});

// Test d'integration : on exerce processEmail() de bout en bout sur un mail
// noreply avec un faux client OpenAI dont AUCUNE methode ne doit etre
// appelee. On verifie aussi qu'aucun insert n'arrive dans inboria_facts /
// inboria_episodes / inboria_signals. C'est la garantie comportementale
// que le garde-fou agit AVANT toute ecriture / appel LLM coute.
describe("inboria-extractor processEmail noise short-circuit", () => {
  beforeEach(() => {
    insertFacts.mockClear();
    insertEpisodes.mockClear();
    insertSignals.mockClear();
    updateEmails.mockClear();
  });

  it("noreply email: 0 OpenAI calls and 0 inserts (facts/episodes/signals)", async () => {
    const openaiCreate = vi.fn();
    const embeddingsCreate = vi.fn();
    const fakeOpenAI = {
      chat: { completions: { create: openaiCreate } },
      embeddings: { create: embeddingsCreate },
    } as any;

    const noiseEmail = {
      id: 42,
      user_id: "u1",
      shared_mailbox_id: null,
      sender: '"Stripe" <noreply@stripe.com>',
      recipient: "alice@startup.fr",
      subject: "Your receipt from Stripe",
      body: "Thanks for your payment. Receipt INV-001 is attached.".repeat(5),
      sent_at: null,
      received_at: new Date().toISOString(),
      is_private: false,
    } as any;

    const outcome = await processEmail(fakeOpenAI, noiseEmail, new Map());

    expect(outcome).toBe("skipped");
    expect(openaiCreate).not.toHaveBeenCalled();
    expect(embeddingsCreate).not.toHaveBeenCalled();
    expect(insertFacts).not.toHaveBeenCalled();
    expect(insertEpisodes).not.toHaveBeenCalled();
    expect(insertSignals).not.toHaveBeenCalled();
  });
});
