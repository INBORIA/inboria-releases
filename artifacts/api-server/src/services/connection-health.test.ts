import { describe, it, expect, vi, beforeEach } from "vitest";

const { updateMock, eqUpdateMock, selectMock, eqSelectMock, maybeSingleMock, rpcMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  eqUpdateMock: vi.fn(),
  selectMock: vi.fn(),
  eqSelectMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: selectMock,
      update: updateMock,
    })),
    rpc: rpcMock,
  },
}));

vi.mock("../lib/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  },
}));

import {
  markConnectionFailure,
  markConnectionSuccess,
  fetchWithTimeout,
  withTimeout,
  safeRunForConnection,
  runSyncLoop,
} from "./connection-health";

beforeEach(() => {
  vi.clearAllMocks();
  selectMock.mockReturnValue({ eq: eqSelectMock });
  eqSelectMock.mockReturnValue({ maybeSingle: maybeSingleMock });
  updateMock.mockReturnValue({ eq: eqUpdateMock });
  eqUpdateMock.mockResolvedValue({ error: null });
  rpcMock.mockResolvedValue({ error: null });
});

describe("markConnectionFailure", () => {
  it("uses atomic RPC by default", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    await markConnectionFailure("conn-1", "fetch", new Error("boom"));
    expect(rpcMock).toHaveBeenCalledWith("increment_connection_failure", {
      p_id: "conn-1",
      p_error_message: expect.stringContaining("[fetch]"),
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("falls back to read-modify-write when RPC missing", async () => {
    rpcMock.mockResolvedValueOnce({ error: { message: "function not found" } });
    maybeSingleMock.mockResolvedValueOnce({ data: { consecutive_failures: 2 }, error: null });
    await markConnectionFailure("conn-1", "fetch", new Error("boom"));
    expect(updateMock).toHaveBeenCalledTimes(1);
    const payload = updateMock.mock.calls[0][0];
    expect(payload.consecutive_failures).toBe(3);
    expect(payload.last_error_message).toContain("boom");
  });

  it("starts at 1 when no prior failures (fallback path)", async () => {
    rpcMock.mockResolvedValueOnce({ error: { message: "missing" } });
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    await markConnectionFailure("conn-1", "connect", new Error("nope"));
    expect(updateMock.mock.calls[0][0].consecutive_failures).toBe(1);
  });

  it("redacts Bearer tokens and JWTs from error message", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    const err = new Error("Unauthorized: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature failed");
    await markConnectionFailure("conn-1", "graph-api", err);
    const payload = rpcMock.mock.calls[0][1];
    expect(payload.p_error_message).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(payload.p_error_message).toContain("[redacted]");
  });

  it("truncates very long error messages to 500 chars", async () => {
    rpcMock.mockResolvedValueOnce({ error: null });
    const longErr = new Error("X".repeat(2000));
    await markConnectionFailure("conn-1", "fetch", longErr);
    expect(rpcMock.mock.calls[0][1].p_error_message.length).toBeLessThanOrEqual(500);
  });

  it("does not throw when fallback read also fails", async () => {
    rpcMock.mockResolvedValueOnce({ error: { message: "rpc down" } });
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    await expect(markConnectionFailure("conn-1", "fetch", new Error("x"))).resolves.toBeUndefined();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("runAutoSync (integration: end-to-end isolation)", () => {
  it("processes every connection even if one provider call rejects, and records the failure for the bad one only", async () => {
    rpcMock.mockResolvedValue({ error: null });

    const { runAutoSync } = await import("./auto-sync");

    const dispatcher = vi.fn(async (conn: any) => {
      if (conn.id === "broken") throw new Error("client.connect ECONNREFUSED");
      return 4;
    });

    await runAutoSync({
      connections: [
        { id: "ok-1", email_address: "a@x", provider: "imap" },
        { id: "broken", email_address: "b@x", provider: "imap" },
        { id: "ok-2", email_address: "c@x", provider: "outlook" },
      ],
      dispatcher,
      skipBackfill: true,
    });

    expect(dispatcher).toHaveBeenCalledTimes(3);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][1].p_id).toBe("broken");
    expect(rpcMock.mock.calls[0][1].p_error_message).toContain("client.connect ECONNREFUSED");
  });
});

describe("runSyncLoop (runAutoSync isolation behavior)", () => {
  it("processes every connection even when one provider call rejects (simulates IMAP client.connect rejection)", async () => {
    rpcMock.mockResolvedValue({ error: null });

    const connections = [
      { id: "c1", email_address: "ok1@test.com", provider: "imap" },
      { id: "c2", email_address: "fail@test.com", provider: "imap" },
      { id: "c3", email_address: "ok3@test.com", provider: "outlook" },
    ];

    const dispatcher = vi.fn(async (conn: any) => {
      if (conn.id === "c2") {
        throw new Error("client.connect ECONNREFUSED");
      }
      return conn.provider === "imap" ? 5 : 3;
    });

    const result = await runSyncLoop(connections as any, dispatcher);

    expect(dispatcher).toHaveBeenCalledTimes(3);
    expect(result.totalSynced).toBe(8);
    expect(result.failureCount).toBe(1);
    expect(result.perConnection).toEqual([
      { id: "c1", email: "ok1@test.com", synced: 5 },
      { id: "c2", email: "fail@test.com", synced: -1 },
      { id: "c3", email: "ok3@test.com", synced: 3 },
    ]);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][1].p_id).toBe("c2");
    expect(rpcMock.mock.calls[0][1].p_error_message).toContain("client.connect ECONNREFUSED");
  });

  it("returns zero failures when all connections succeed", async () => {
    const connections = [
      { id: "c1", email_address: "a@x", provider: "gmail" },
      { id: "c2", email_address: "b@x", provider: "imap" },
    ];
    const result = await runSyncLoop(connections as any, async () => 2);
    expect(result.totalSynced).toBe(4);
    expect(result.failureCount).toBe(0);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("safeRunForConnection (per-connection isolation)", () => {
  it("isolates failures: one bad connection does not break the others, and markConnectionFailure is recorded for the failing one only", async () => {
    rpcMock.mockResolvedValue({ error: null });

    const conn1 = { id: "c1", email_address: "fail@test.com" };
    const conn2 = { id: "c2", email_address: "ok@test.com" };
    const conn3 = { id: "c3", email_address: "also-ok@test.com" };

    const results: Array<number | -1> = [];
    for (const conn of [conn1, conn2, conn3]) {
      const synced = await safeRunForConnection(conn, "fetch", async () => {
        if (conn.id === "c1") throw new Error("simulated IMAP crash");
        return 7;
      });
      results.push(synced);
    }

    expect(results).toEqual([-1, 7, 7]);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][1].p_id).toBe("c1");
    expect(rpcMock.mock.calls[0][1].p_error_message).toContain("simulated IMAP crash");
  });

  it("returns the function result on success without calling markConnectionFailure", async () => {
    const result = await safeRunForConnection({ id: "c1", email_address: "ok@x" }, "fetch", async () => 42);
    expect(result).toBe(42);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("does not throw if conn.id is missing", async () => {
    const result = await safeRunForConnection({ email_address: "anon" }, "fetch", async () => {
      throw new Error("oops");
    });
    expect(result).toBe(-1);
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("markConnectionSuccess", () => {
  it("resets failure counter and updates last_synced_at", async () => {
    await markConnectionSuccess("conn-1");
    expect(updateMock).toHaveBeenCalledTimes(1);
    const payload = updateMock.mock.calls[0][0];
    expect(payload.consecutive_failures).toBe(0);
    expect(payload.last_error_at).toBeNull();
    expect(payload.last_error_message).toBeNull();
    expect(typeof payload.last_synced_at).toBe("string");
  });
});

describe("fetchWithTimeout", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("aborts when fetch exceeds timeout", async () => {
    globalThis.fetch = vi.fn((_url: any, init: any) => {
      return new Promise((_, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
    }) as any;
    await expect(fetchWithTimeout("http://example", { timeoutMs: 50 })).rejects.toThrow();
  });

  it("returns response when fetch resolves before timeout", async () => {
    globalThis.fetch = vi.fn(async () => new Response("ok", { status: 200 })) as any;
    const res = await fetchWithTimeout("http://example", { timeoutMs: 1000 });
    expect(res.status).toBe(200);
  });
});

describe("withTimeout", () => {
  it("rejects with timeout error when promise stalls", async () => {
    const stuck = new Promise<number>(() => {});
    await expect(withTimeout(stuck, 30, "stuck-op")).rejects.toThrow(/stuck-op timeout after 30ms/);
  });

  it("resolves with original value when promise completes in time", async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, "fast-op");
    expect(result).toBe(42);
  });
});
