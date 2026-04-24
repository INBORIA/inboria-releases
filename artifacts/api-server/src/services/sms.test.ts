/**
 * Tests for the Twilio inbound webhook tenant-isolation logic.
 *
 * The original code looped over every channel matching the destination phone
 * number, which would deliver an inbound SMS to *both* tenants if two of them
 * had somehow configured the same Twilio number — a cross-tenant PII leak.
 * The fixed code resolves to exactly one channel and refuses to route when
 * multiple match (defense-in-depth alongside the partial unique index added
 * in `2026_04_24_v4_messaging_tenant_isolation.sql`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, insertMock, updateChannelMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  insertMock: vi.fn(),
  updateChannelMock: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: fromMock },
}));

vi.mock("./webhook-emitter", () => ({
  emitEvent: vi.fn(async () => undefined),
}));

import { ingestTwilioWebhook } from "./sms";

function setupChannels(rows: Array<{ id: string; user_id: string; phone_number: string }>) {
  fromMock.mockImplementation((table: string) => {
    if (table === "messaging_channels") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: rows }),
            }),
          }),
        }),
        update: updateChannelMock.mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === "messages") {
      return { insert: insertMock.mockResolvedValue({ error: null }) };
    }
    return {};
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ingestTwilioWebhook tenant isolation", () => {
  it("routes the inbound to the single matching tenant", async () => {
    setupChannels([{ id: "c1", user_id: "user-A", phone_number: "+15551234567" }]);
    const out = await ingestTwilioWebhook({
      From: "+15559876543",
      To: "+15551234567",
      Body: "Hello",
      MessageSid: "SM_OK",
    });
    expect(out).toEqual({ processed: true });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0]?.[0]).toMatchObject({
      user_id: "user-A",
      provider: "sms_twilio",
      direction: "inbound",
      external_id: "SM_OK",
      from_address: "+15559876543",
      to_address: "+15551234567",
    });
  });

  it("refuses to route when multiple tenants share the same destination number (cross-tenant safety)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setupChannels([
      { id: "c1", user_id: "user-A", phone_number: "+15551234567" },
      { id: "c2", user_id: "user-B", phone_number: "+15551234567" },
    ]);
    const out = await ingestTwilioWebhook({
      From: "+15559876543",
      To: "+15551234567",
      Body: "secret",
      MessageSid: "SM_DUP",
    });
    expect(out).toEqual({ processed: false });
    // The critical assertion: NO message was inserted for either tenant.
    expect(insertMock).not.toHaveBeenCalled();
    // And we logged a security warning so ops can investigate.
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("[sms][SECURITY]"),
      expect.objectContaining({ toPhone: "+15551234567" }),
    );
    errSpy.mockRestore();
  });

  it("returns processed=false when no channel matches (no leakage)", async () => {
    setupChannels([]);
    const out = await ingestTwilioWebhook({
      From: "+15559876543",
      To: "+15550000000",
      Body: "stranger",
      MessageSid: "SM_NONE",
    });
    expect(out).toEqual({ processed: false });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
