import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoverImapJunkFolder, discoverImapTrashFolder, moveOutlookMessage } from "./junk-sync";

describe("discoverImapJunkFolder", () => {
  it("uses cached path when mailboxOpen succeeds", async () => {
    const client: any = {
      mailboxOpen: vi.fn().mockResolvedValue({ exists: 0 }),
      mailboxClose: vi.fn().mockResolvedValue(undefined),
      list: vi.fn(),
    };
    const path = await discoverImapJunkFolder(client, "INBOX.Junk");
    expect(path).toBe("INBOX.Junk");
    expect(client.list).not.toHaveBeenCalled();
  });

  it("falls back to LIST when cached path is invalid", async () => {
    const client: any = {
      mailboxOpen: vi.fn().mockRejectedValue(new Error("nope")),
      mailboxClose: vi.fn(),
      list: vi.fn().mockResolvedValue([
        { path: "INBOX", flags: new Set() },
        { path: "Junk Email", flags: new Set(["\\Junk"]) },
      ]),
    };
    const path = await discoverImapJunkFolder(client, "stale-path");
    expect(path).toBe("Junk Email");
  });

  it("uses fallback names when no SPECIAL-USE flag found", async () => {
    const client: any = {
      mailboxOpen: vi.fn(),
      list: vi.fn().mockResolvedValue([
        { path: "INBOX", flags: new Set() },
        { path: "Indésirables", flags: new Set() },
      ]),
    };
    const path = await discoverImapJunkFolder(client, null);
    expect(path).toBe("Indésirables");
  });

  it("returns null when nothing matches", async () => {
    const client: any = {
      mailboxOpen: vi.fn(),
      list: vi.fn().mockResolvedValue([{ path: "INBOX", flags: new Set() }]),
    };
    const path = await discoverImapJunkFolder(client, null);
    expect(path).toBeNull();
  });
});

describe("discoverImapTrashFolder", () => {
  it("detects \\Trash SPECIAL-USE", async () => {
    const client: any = {
      list: vi.fn().mockResolvedValue([
        { path: "INBOX", flags: new Set() },
        { path: "Deleted Items", flags: new Set(["\\Trash"]) },
      ]),
    };
    const path = await discoverImapTrashFolder(client);
    expect(path).toBe("Deleted Items");
  });

  it("falls back to localized name", async () => {
    const client: any = {
      list: vi.fn().mockResolvedValue([
        { path: "INBOX", flags: new Set() },
        { path: "Corbeille", flags: new Set() },
      ]),
    };
    const path = await discoverImapTrashFolder(client);
    expect(path).toBe("Corbeille");
  });

  it("returns null when no candidate", async () => {
    const client: any = {
      list: vi.fn().mockResolvedValue([{ path: "INBOX", flags: new Set() }]),
    };
    const path = await discoverImapTrashFolder(client);
    expect(path).toBeNull();
  });
});

describe("moveOutlookMessage", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  it.each([
    ["inbox" as const, "inbox"],
    ["junkemail" as const, "junkemail"],
    ["deleteditems" as const, "deleteditems"],
  ])("posts to Graph /move with destinationId=%s", async (dest, expected) => {
    let captured: any = null;
    globalThis.fetch = vi.fn(async (_url: any, init: any) => {
      captured = JSON.parse(init.body);
      return new Response(JSON.stringify({ id: "new-id-123" }), { status: 200 });
    }) as any;

    const result = await moveOutlookMessage("token", "msg-id", dest);
    expect(result).toEqual({ ok: true, newId: "new-id-123" });
    expect(captured.destinationId).toBe(expected);
  });

  it("returns ok:false on non-2xx response", async () => {
    globalThis.fetch = vi.fn(async () => new Response("forbidden", { status: 403 })) as any;
    const result = await moveOutlookMessage("token", "msg-id", "junkemail");
    expect(result).toEqual({ ok: false });
  });

  it("returns ok:false on fetch throw", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("network down"); }) as any;
    const result = await moveOutlookMessage("token", "msg-id", "inbox");
    expect(result).toEqual({ ok: false });
  });
});
