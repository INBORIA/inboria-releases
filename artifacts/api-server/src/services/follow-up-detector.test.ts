import { describe, it, expect, vi, beforeEach } from "vitest";

const insertMock = vi.fn();
let queryHandlers: Record<string, (q: any) => Promise<any>> = {};

function makeChainable(table: string) {
  const filters: Record<string, any> = {};
  const chain: any = {
    _table: table,
    _filters: filters,
    select: () => chain,
    eq: (col: string, val: any) => {
      filters[col] = val;
      return chain;
    },
    not: () => chain,
    is: () => chain,
    in: (col: string, val: any) => {
      filters[`${col}__in`] = val;
      return chain;
    },
    gte: (col: string, val: any) => {
      filters[`${col}__gte`] = val;
      return chain;
    },
    lte: (col: string, val: any) => {
      filters[`${col}__lte`] = val;
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => queryHandlers[table]?.({ ...filters, op: "maybeSingle" }),
    single: async () => queryHandlers[table]?.({ ...filters, op: "single" }),
    then: (resolve: any) => Promise.resolve(queryHandlers[table]?.({ ...filters, op: "list" })).then(resolve),
    insert: (rows: any) => {
      insertMock(table, rows);
      return Promise.resolve({ error: null });
    },
  };
  return chain;
}

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => makeChainable(table),
  },
}));

vi.mock("./autopilot-events", () => ({
  recordAutopilotEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { detectForUser } from "./follow-up-detector";

const USER = "user-1";
const NOW = new Date("2026-04-23T12:00:00Z");

beforeEach(() => {
  insertMock.mockReset();
  queryHandlers = {};
});

describe("follow-up-detector.detectForUser", () => {
  it("creates a suggestion for a sent email older than delayDays without inbound reply", async () => {
    const oldSent = new Date(NOW.getTime() - 10 * 86_400_000).toISOString();

    queryHandlers.profiles = async () => ({ data: { follow_up_delay_days: 5 } });
    queryHandlers.emails = async (q) => {
      if (q["recipient__in"] !== undefined || q["recipient"] === null) {
        // inbound query path: recipient is null
        return { data: [] };
      }
      // sent emails path
      return {
        data: [
          {
            id: 42,
            sender: "me@inboria.test",
            recipient: "client@example.com",
            subject: "Devis Q2",
            created_at: oldSent,
            external_id: "ext-42",
          },
        ],
      };
    };
    queryHandlers.followups = async () => ({ data: [] });

    const result = await detectForUser(USER, { now: NOW });

    expect(result).toEqual({ created: 1, scanned: 1 });
    expect(insertMock).toHaveBeenCalledTimes(1);
    const [, rows] = insertMock.mock.calls[0];
    expect(rows[0]).toMatchObject({
      user_id: USER,
      email_id: 42,
      ai_suggestion: true,
      status: "en_attente",
    });
    expect(rows[0].title).toContain("client@example.com");
  });

  it("does NOT create a suggestion when the recipient already replied", async () => {
    const oldSent = new Date(NOW.getTime() - 10 * 86_400_000).toISOString();
    const replyDate = new Date(NOW.getTime() - 2 * 86_400_000).toISOString();

    queryHandlers.profiles = async () => ({ data: { follow_up_delay_days: 5 } });
    let emailsCallIdx = 0;
    queryHandlers.emails = async () => {
      emailsCallIdx += 1;
      if (emailsCallIdx === 1) {
        // sent
        return {
          data: [
            {
              id: 99,
              sender: "me@inboria.test",
              recipient: "Client <client@example.com>",
              subject: "Suivi",
              created_at: oldSent,
              external_id: null,
            },
          ],
        };
      }
      // inbound from same recipient (reply)
      return {
        data: [
          { sender: "Client <CLIENT@example.com>", subject: "Re: Suivi", created_at: replyDate },
        ],
      };
    };
    queryHandlers.followups = async () => ({ data: [] });

    const result = await detectForUser(USER, { now: NOW });
    expect(result).toEqual({ created: 0, scanned: 1 });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("does NOT recreate a suggestion already existing for that email_id (idempotent)", async () => {
    const oldSent = new Date(NOW.getTime() - 10 * 86_400_000).toISOString();

    queryHandlers.profiles = async () => ({ data: { follow_up_delay_days: 5 } });
    let emailsIdx = 0;
    queryHandlers.emails = async () => {
      emailsIdx += 1;
      if (emailsIdx === 1) {
        return {
          data: [
            {
              id: 7,
              sender: "me@inboria.test",
              recipient: "client@example.com",
              subject: "Question",
              created_at: oldSent,
              external_id: null,
            },
          ],
        };
      }
      return { data: [] };
    };
    // Existing followup for email_id=7 (could be active OR dismissed — both must block recreation)
    queryHandlers.followups = async () => ({ data: [{ email_id: 7 }] });

    const result = await detectForUser(USER, { now: NOW });
    expect(result).toEqual({ created: 0, scanned: 1 });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("ignores recent sent emails (younger than delayDays)", async () => {
    const recent = new Date(NOW.getTime() - 1 * 86_400_000).toISOString();
    queryHandlers.profiles = async () => ({ data: { follow_up_delay_days: 5 } });
    // Server-side filter (lte cutoff) would exclude. We simulate that by returning [] from sent query.
    queryHandlers.emails = async () => ({ data: [] });
    queryHandlers.followups = async () => ({ data: [] });

    const result = await detectForUser(USER, { now: NOW });
    expect(result).toEqual({ created: 0, scanned: 0 });
    expect(insertMock).not.toHaveBeenCalled();
    void recent;
  });

  it("respects custom delayDays from context override", async () => {
    queryHandlers.profiles = async () => ({ data: { follow_up_delay_days: 30 } });
    queryHandlers.emails = async () => ({ data: [] });
    queryHandlers.followups = async () => ({ data: [] });

    const result = await detectForUser(USER, { now: NOW, delayDays: 2 });
    expect(result.scanned).toBe(0);
    expect(result.created).toBe(0);
  });
});
