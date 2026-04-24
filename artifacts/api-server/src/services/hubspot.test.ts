import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn(), rpc: vi.fn() },
}));

import { exchangeHubspotCode, HUBSPOT_SCOPES } from "./hubspot";

beforeEach(() => {
  vi.restoreAllMocks();
  process.env["HUBSPOT_CLIENT_ID"] = "cid";
  process.env["HUBSPOT_CLIENT_SECRET"] = "csecret";
});

afterEach(() => {
  delete process.env["HUBSPOT_CLIENT_ID"];
  delete process.env["HUBSPOT_CLIENT_SECRET"];
});

describe("HUBSPOT_SCOPES", () => {
  it("includes contact read/write scopes", () => {
    expect(HUBSPOT_SCOPES).toContain("crm.objects.contacts.read");
    expect(HUBSPOT_SCOPES).toContain("crm.objects.contacts.write");
  });
});

describe("exchangeHubspotCode", () => {
  it("returns null when client credentials are missing", async () => {
    delete process.env["HUBSPOT_CLIENT_ID"];
    const out = await exchangeHubspotCode("code123", "https://app.test/cb");
    expect(out).toBeNull();
  });

  it("returns null when HubSpot returns a non-OK response", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "bad code",
    } as any);
    const out = await exchangeHubspotCode("bad", "https://app.test/cb");
    expect(out).toBeNull();
  });

  it("returns tokens (with hubId) when HubSpot exchange + introspection succeed", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "at-1",
          refresh_token: "rt-1",
          expires_in: 1800,
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ hub_id: 4242, app_id: 1, scopes: [] }),
      } as any);

    const out = await exchangeHubspotCode("code-ok", "https://app.test/cb");
    expect(out).toEqual({ accessToken: "at-1", refreshToken: "rt-1", expiresIn: 1800, hubId: 4242 });

    const call = fetchSpy.mock.calls[0] as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe("https://api.hubapi.com/oauth/v1/token");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    const body = (init.body as string) || "";
    expect(body).toContain("grant_type=authorization_code");
    expect(body).toContain("code=code-ok");
    expect(body).toContain("client_id=cid");
    expect(body).toContain("client_secret=csecret");

    // Second call introspects the freshly minted access token to extract hub_id.
    const second = fetchSpy.mock.calls[1] as [string, RequestInit];
    expect(second[0]).toBe("https://api.hubapi.com/oauth/v1/access-tokens/at-1");
  });

  it("still returns tokens when introspection fails (hubId = null)", async () => {
    vi.spyOn(globalThis, "fetch" as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "at-2", refresh_token: "rt-2", expires_in: 60 }),
      } as any)
      .mockResolvedValueOnce({ ok: false, status: 500 } as any);

    const out = await exchangeHubspotCode("code-ok", "https://app.test/cb");
    expect(out).toEqual({ accessToken: "at-2", refreshToken: "rt-2", expiresIn: 60, hubId: null });
  });
});
