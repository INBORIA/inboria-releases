import { describe, it, expect, vi } from "vitest";
import {
  blockSenderOnProvider,
  unblockSenderOnProvider,
  type ConnectionForBlock,
} from "./blocked-senders";

function microsoftConn(overrides: Partial<ConnectionForBlock> = {}): ConnectionForBlock {
  return {
    id: "conn-ms-1",
    provider: "microsoft",
    email_address: "user@example.com",
    access_token: "ms-access-token",
    refresh_token: "ms-refresh-token",
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  };
}

function gmailConn(overrides: Partial<ConnectionForBlock> = {}): ConnectionForBlock {
  return {
    id: "conn-gmail-1",
    provider: "google",
    email_address: "user@gmail.com",
    access_token: "g-access-token",
    refresh_token: "g-refresh-token",
    token_expires_at: null,
    ...overrides,
  };
}

function fakeFetchOk(body: any, status = 200): any {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });
}

describe("blockSenderOnProvider — Microsoft", () => {
  it("creates a messageRule via Graph and returns the rule id", async () => {
    const fetchGraph = fakeFetchOk({ id: "rule-abc" });
    const result = await blockSenderOnProvider(
      microsoftConn(),
      "Spammer@Example.COM",
      { fetchGraph, resolveMsToken: async () => "valid-token" },
    );
    expect(result.ok).toBe(true);
    expect(result.providerRuleId).toBe("rule-abc");
    expect(fetchGraph).toHaveBeenCalledTimes(1);
    const [url, init] = fetchGraph.mock.calls[0]!;
    expect(url).toBe("https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer valid-token");
    const payload = JSON.parse(init.body);
    expect(payload.conditions.fromAddresses[0].emailAddress.address).toBe("spammer@example.com");
    expect(payload.actions.moveToFolder).toBe("junkemail");
    expect(payload.actions.stopProcessingRules).toBe(true);
    expect(payload.isEnabled).toBe(true);
  });

  it("returns auth_failed when token cannot be obtained", async () => {
    const fetchGraph = vi.fn();
    const result = await blockSenderOnProvider(
      microsoftConn(),
      "x@y.com",
      { fetchGraph, resolveMsToken: async () => null },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("auth_failed");
    expect(fetchGraph).not.toHaveBeenCalled();
  });

  it("returns api_error when Graph responds non-2xx", async () => {
    const fetchGraph = fakeFetchOk({ error: "boom" }, 500);
    const result = await blockSenderOnProvider(
      microsoftConn(),
      "x@y.com",
      { fetchGraph, resolveMsToken: async () => "tok" },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("api_error");
    expect(result.providerRuleId).toBeNull();
  });
});

describe("blockSenderOnProvider — Gmail", () => {
  it("creates a filter via Gmail API and returns the filter id", async () => {
    const create = vi.fn().mockResolvedValue({ data: { id: "filter-xyz" } });
    const buildGmail = vi.fn().mockResolvedValue({
      users: { settings: { filters: { create } } },
    });
    const result = await blockSenderOnProvider(
      gmailConn(),
      "Spammer@Gmail.com",
      { buildGmail },
    );
    expect(result.ok).toBe(true);
    expect(result.providerRuleId).toBe("filter-xyz");
    expect(create).toHaveBeenCalledWith({
      userId: "me",
      requestBody: {
        criteria: { from: "spammer@gmail.com" },
        action: { addLabelIds: ["TRASH"], removeLabelIds: ["INBOX"] },
      },
    });
  });

  it("returns api_error on Gmail API exception", async () => {
    const create = vi.fn().mockRejectedValue(new Error("quota exceeded"));
    const buildGmail = vi.fn().mockResolvedValue({
      users: { settings: { filters: { create } } },
    });
    const result = await blockSenderOnProvider(gmailConn(), "x@y.com", { buildGmail });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("api_error");
    expect(result.message).toBe("quota exceeded");
  });
});

describe("blockSenderOnProvider — IMAP / unsupported", () => {
  it("returns unsupported_provider for imap", async () => {
    const result = await blockSenderOnProvider(
      { ...gmailConn(), provider: "imap" },
      "x@y.com",
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("unsupported_provider");
    expect(result.providerRuleId).toBeNull();
  });
});

describe("unblockSenderOnProvider — Microsoft", () => {
  it("DELETEs the rule via Graph", async () => {
    const fetchGraph = fakeFetchOk({}, 204);
    const result = await unblockSenderOnProvider(
      microsoftConn(),
      "rule-abc",
      { fetchGraph, resolveMsToken: async () => "tok" },
    );
    expect(result.ok).toBe(true);
    const [url, init] = fetchGraph.mock.calls[0]!;
    expect(url).toBe(
      "https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messageRules/rule-abc",
    );
    expect(init.method).toBe("DELETE");
  });

  it("treats 404 as success (idempotent)", async () => {
    const fetchGraph = fakeFetchOk({}, 404);
    const result = await unblockSenderOnProvider(
      microsoftConn(),
      "rule-abc",
      { fetchGraph, resolveMsToken: async () => "tok" },
    );
    expect(result.ok).toBe(true);
  });

  it("no-op when providerRuleId is null", async () => {
    const fetchGraph = vi.fn();
    const result = await unblockSenderOnProvider(
      microsoftConn(),
      null,
      { fetchGraph, resolveMsToken: async () => "tok" },
    );
    expect(result.ok).toBe(true);
    expect(fetchGraph).not.toHaveBeenCalled();
  });
});

describe("unblockSenderOnProvider — Gmail", () => {
  it("deletes the filter via Gmail API", async () => {
    const del = vi.fn().mockResolvedValue({});
    const buildGmail = vi.fn().mockResolvedValue({
      users: { settings: { filters: { delete: del } } },
    });
    const result = await unblockSenderOnProvider(gmailConn(), "filter-xyz", { buildGmail });
    expect(result.ok).toBe(true);
    expect(del).toHaveBeenCalledWith({ userId: "me", id: "filter-xyz" });
  });

  it("treats 404 from Gmail as success", async () => {
    const del = vi.fn().mockRejectedValue(Object.assign(new Error("not found"), { code: 404 }));
    const buildGmail = vi.fn().mockResolvedValue({
      users: { settings: { filters: { delete: del } } },
    });
    const result = await unblockSenderOnProvider(gmailConn(), "filter-xyz", { buildGmail });
    expect(result.ok).toBe(true);
  });
});
