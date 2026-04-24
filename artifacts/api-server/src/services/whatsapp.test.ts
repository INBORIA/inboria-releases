import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  fromMock,
  selectChannelMock,
  eqUserMock,
  eqProviderMock,
  eqEnabledMock,
  limitMock,
  maybeSingleMock,
  insertMock,
  selectMessagesMock,
  msgEq1Mock,
  msgEq2Mock,
  msgEq3Mock,
  msgEq4Mock,
  msgGteMock,
  msgLimitMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectChannelMock: vi.fn(),
  eqUserMock: vi.fn(),
  eqProviderMock: vi.fn(),
  eqEnabledMock: vi.fn(),
  limitMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  insertMock: vi.fn(),
  selectMessagesMock: vi.fn(),
  msgEq1Mock: vi.fn(),
  msgEq2Mock: vi.fn(),
  msgEq3Mock: vi.fn(),
  msgEq4Mock: vi.fn(),
  msgGteMock: vi.fn(),
  msgLimitMock: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: fromMock },
}));

import { sendWhatsappMessage } from "./whatsapp";

/**
 * Configures the supabase mock to return:
 * - the supplied channel from `messaging_channels` lookups
 * - the supplied inbound-message history rows from `messages` 24h-window lookups
 *   (default: 1 row → window open → free-text allowed)
 */
function setupChannelLookup(channel: any, inboundHistory: Array<{ id: string }> = [{ id: "m1" }]) {
  fromMock.mockImplementation((table: string) => {
    if (table === "messaging_channels") {
      return {
        select: selectChannelMock.mockReturnValue({
          eq: eqUserMock.mockReturnValue({
            eq: eqProviderMock.mockReturnValue({
              eq: eqEnabledMock.mockReturnValue({
                limit: limitMock.mockReturnValue({
                  maybeSingle: maybeSingleMock.mockResolvedValue({ data: channel }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "messages") {
      return {
        insert: insertMock.mockResolvedValue({ error: null }),
        select: selectMessagesMock.mockReturnValue({
          eq: msgEq1Mock.mockReturnValue({
            eq: msgEq2Mock.mockReturnValue({
              eq: msgEq3Mock.mockReturnValue({
                eq: msgEq4Mock.mockReturnValue({
                  gte: msgGteMock.mockReturnValue({
                    limit: msgLimitMock.mockResolvedValue({ data: inboundHistory }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    return {};
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendWhatsappMessage", () => {
  it("returns error when no channel is found", async () => {
    setupChannelLookup(null);
    const out = await sendWhatsappMessage("u1", "+33123", "hi");
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/no whatsapp channel/);
  });

  it("returns error when channel credentials are missing", async () => {
    setupChannelLookup({ id: "c1", phone_number: "+33000", credentials: {} });
    const out = await sendWhatsappMessage("u1", "+33123", "hi");
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/missing credentials/);
  });

  it("posts a text message to Meta Graph API and stores it (within 24h window)", async () => {
    setupChannelLookup({
      id: "c1",
      phone_number: "+33000",
      credentials: { phoneNumberId: "PN1", accessToken: "AT1" },
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.123" }] }),
    } as any);

    const out = await sendWhatsappMessage("u1", "+33123", "hello");
    expect(out.ok).toBe(true);
    expect(out.messageId).toBe("wamid.123");

    const call = fetchSpy.mock.calls[0] as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe("https://graph.facebook.com/v20.0/PN1/messages");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer AT1");
    const body = JSON.parse(init.body as string);
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.to).toBe("+33123");
    expect(body.type).toBe("text");
    expect(body.text.body).toBe("hello");

    expect(insertMock).toHaveBeenCalledTimes(1);
    const inserted = insertMock.mock.calls[0]?.[0];
    expect(inserted).toMatchObject({
      provider: "whatsapp",
      direction: "outbound",
      external_id: "wamid.123",
      to_address: "+33123",
      body: "hello",
    });
  });

  it("propagates Meta API errors", async () => {
    setupChannelLookup({
      id: "c1",
      phone_number: "+33000",
      credentials: { phoneNumberId: "PN1", accessToken: "AT1" },
    });
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "{\"error\":\"bad\"}",
    } as any);

    const out = await sendWhatsappMessage("u1", "+33123", "hello");
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/Meta API 400/);
  });

  it("refuses free-text when the recipient has not messaged in the last 24h (Meta policy)", async () => {
    setupChannelLookup(
      {
        id: "c1",
        phone_number: "+33000",
        credentials: { phoneNumberId: "PN1", accessToken: "AT1" },
      },
      [], // no inbound history → 24h window is closed
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any);

    const out = await sendWhatsappMessage("u1", "+33999", "hello");
    expect(out.ok).toBe(false);
    expect(out.error).toBe("whatsapp_24h_window_closed");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("allows template messages outside the 24h window without an inbound history", async () => {
    setupChannelLookup(
      {
        id: "c1",
        phone_number: "+33000",
        credentials: { phoneNumberId: "PN1", accessToken: "AT1" },
      },
      [], // no inbound history — but templates bypass the window
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.tpl" }] }),
    } as any);

    const out = await sendWhatsappMessage("u1", "+33999", "hello", {
      templateName: "appointment_reminder",
      templateLanguage: "fr",
    });
    expect(out.ok).toBe(true);
    expect(out.messageId).toBe("wamid.tpl");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.type).toBe("template");
    expect(sentBody.template.name).toBe("appointment_reminder");
  });
});
