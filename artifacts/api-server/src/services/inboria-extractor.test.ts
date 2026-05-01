import { describe, expect, it } from "vitest";
import { isNoiseEmail, NOISE_SENDER_REGEX } from "./auto-sync";

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
