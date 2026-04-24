import { describe, it, expect } from "vitest";
import {
  parseRuleHeuristic,
  validateRulePayload,
  matchesConditions,
  detectVariablesInBody,
  applyTemplateVariables,
} from "./automation-rules";

describe("parseRuleHeuristic", () => {
  it("parses a French rule with sender + archive", () => {
    const r = parseRuleHeuristic(
      "Quand un mail vient de noreply@github.com, archive-le.",
      "Archives GitHub",
    );
    expect(r).not.toBeNull();
    expect(r!.name).toBe("Archives GitHub");
    expect(r!.conditions.all?.length).toBeGreaterThan(0);
    expect(r!.conditions.all?.[0]).toMatchObject({
      field: "sender",
      op: "contains",
      value: "noreply@github.com",
    });
    expect(r!.actions.some((a) => a.type === "archive")).toBe(true);
  });

  it("parses an English rule with subject + categorize", () => {
    const r = parseRuleHeuristic(
      'When the subject contains "Invoice", categorize as Billing.',
    );
    expect(r).not.toBeNull();
    expect(r!.conditions.all?.[0]).toMatchObject({
      field: "subject",
      op: "contains",
      value: "Invoice",
    });
    expect(r!.actions.find((a) => a.type === "categorize")).toMatchObject({
      type: "categorize",
      category: "Billing",
    });
  });

  it("parses a Dutch transfer rule", () => {
    const r = parseRuleHeuristic(
      "Als een mail van facturen@acme.com komt, transfer naar boekhouding@acme.com",
    );
    expect(r).not.toBeNull();
    expect(r!.actions.find((a) => a.type === "transfer")).toMatchObject({
      type: "transfer",
      to: "boekhouding@acme.com",
    });
  });

  it("returns null when nothing actionable can be parsed", () => {
    const r = parseRuleHeuristic("Bonjour comment ça va aujourd'hui ?");
    expect(r).toBeNull();
  });

  it("parses urgent priority", () => {
    const r = parseRuleHeuristic(
      'When sender contains "boss@", mark as urgent',
    );
    expect(r).not.toBeNull();
    expect(r!.actions.find((a) => a.type === "set_priority")).toMatchObject({
      type: "set_priority",
      priority: "urgent",
    });
  });

  it("parses has_attachment condition (FR)", () => {
    const r = parseRuleHeuristic(
      'Quand le sujet contient "facture" et avec pièce jointe, archive-le.',
    );
    expect(r).not.toBeNull();
    expect(
      r!.conditions.all?.find((c) => c.field === "has_attachment"),
    ).toMatchObject({ field: "has_attachment", op: "is_true" });
  });

  it("parses notify on Slack as slack_notify", () => {
    const r = parseRuleHeuristic(
      'Quand sujet contient "alerte", notifier sur Slack.',
    );
    expect(r).not.toBeNull();
    expect(r!.actions.find((a) => a.type === "slack_notify")).toBeTruthy();
    expect(r!.actions.find((a) => a.type === "notify")).toBeFalsy();
  });

  it("parses Notion page creation", () => {
    const r = parseRuleHeuristic(
      'Quand sujet contient "réunion", créer une page Notion "Compte rendu".',
    );
    expect(r).not.toBeNull();
    expect(r!.actions.find((a) => a.type === "notion_create")).toMatchObject({
      type: "notion_create",
    });
  });
});

describe("validateRulePayload", () => {
  it("accepts a well-formed rule", () => {
    const out = validateRulePayload({
      name: "Test",
      conditions: { all: [{ field: "sender", op: "contains", value: "x" }] },
      actions: [{ type: "archive" }],
    });
    expect(out.ok).toBe(true);
  });

  it("rejects unknown action type", () => {
    const out = validateRulePayload({
      name: "Test",
      conditions: { all: [{ field: "sender", op: "contains", value: "x" }] },
      actions: [{ type: "delete_forever" } as any],
    });
    expect(out.ok).toBe(false);
  });

  it("rejects empty conditions", () => {
    const out = validateRulePayload({
      name: "Test",
      conditions: {},
      actions: [{ type: "archive" }],
    });
    expect(out.ok).toBe(false);
  });

  it("rejects invalid email in transfer action", () => {
    const out = validateRulePayload({
      name: "Test",
      conditions: { all: [{ field: "sender", op: "contains", value: "x" }] },
      actions: [{ type: "transfer", to: "not-an-email" }],
    });
    expect(out.ok).toBe(false);
  });
});

describe("matchesConditions", () => {
  const email = {
    sender: "Alice <alice@acme.com>",
    subject: "Invoice 2026-04",
    body: "Please pay by next week",
    category_name: "Facturation",
  };

  it("matches contains on sender (case-insensitive)", () => {
    expect(
      matchesConditions(email, {
        all: [{ field: "sender", op: "contains", value: "ACME" }],
      }),
    ).toBe(true);
  });

  it("matches regex on subject", () => {
    expect(
      matchesConditions(email, {
        all: [{ field: "subject", op: "regex", value: "^Invoice" }],
      }),
    ).toBe(true);
  });

  it("does not match when not_contains is violated", () => {
    expect(
      matchesConditions(email, {
        all: [{ field: "subject", op: "not_contains", value: "Invoice" }],
      }),
    ).toBe(false);
  });

  it("supports any-of conditions", () => {
    expect(
      matchesConditions(email, {
        any: [
          { field: "subject", op: "contains", value: "nope" },
          { field: "category", op: "equals", value: "Facturation" },
        ],
      }),
    ).toBe(true);
  });

  it("returns false on bad regex", () => {
    expect(
      matchesConditions(email, {
        all: [{ field: "subject", op: "regex", value: "[unclosed" }],
      }),
    ).toBe(false);
  });
});

describe("detectVariablesInBody", () => {
  it("extracts handlebars-style variables", () => {
    const v = detectVariablesInBody(
      "Bonjour {{ first_name }}, votre facture {{invoice_id}} est prête. Merci {{ first_name }}.",
    );
    expect(v.sort()).toEqual(["first_name", "invoice_id"].sort());
  });

  it("returns [] when no variables", () => {
    expect(detectVariablesInBody("Plain text")).toEqual([]);
  });
});

describe("applyTemplateVariables", () => {
  it("resolves {{first_name}} from a 'Name <email>' header", () => {
    const out = applyTemplateVariables("Bonjour {{first_name}},", {
      senderName: "Marie Dupont <marie@acme.com>",
      senderEmail: "marie@acme.com",
    });
    expect(out).toBe("Bonjour Marie,");
  });

  it("resolves French aliases (prenom/nom/sujet)", () => {
    const out = applyTemplateVariables(
      "Bonjour {{prenom}} {{nom}} — re: {{sujet}}",
      {
        senderName: "Marie Dupont",
        subject: "Facture 042",
      },
    );
    expect(out).toBe("Bonjour Marie Dupont — re: Facture 042");
  });

  it("derives my_first_name from the user full name", () => {
    const out = applyTemplateVariables("Cordialement, {{my_first_name}}", {
      userFullName: "Jean Martin",
    });
    expect(out).toBe("Cordialement, Jean");
  });

  it("leaves unknown placeholders untouched", () => {
    const out = applyTemplateVariables("Hello {{unknown_field}}", {});
    expect(out).toBe("Hello {{unknown_field}}");
  });
});

describe("matchesConditions — extended fields", () => {
  it("matches has_attachment is_true", () => {
    expect(
      matchesConditions(
        { has_attachment: true } as any,
        { all: [{ field: "has_attachment", op: "is_true", value: "" }] },
      ),
    ).toBe(true);
    expect(
      matchesConditions(
        { has_attachment: false } as any,
        { all: [{ field: "has_attachment", op: "is_true", value: "" }] },
      ),
    ).toBe(false);
  });

  it("matches project equals", () => {
    expect(
      matchesConditions(
        { project_id: "proj-123" } as any,
        { all: [{ field: "project", op: "equals", value: "proj-123" }] },
      ),
    ).toBe(true);
  });
});
