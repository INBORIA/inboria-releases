import { describe, it, expect, vi, beforeEach } from "vitest";

const updateMock = vi.fn();
const eqUpdateMock = vi.fn();
const selectMock = vi.fn();
const eqSelectMock = vi.fn();
const maybeSingleMock = vi.fn();

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: selectMock,
      update: updateMock,
    })),
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
} from "./connection-health";

beforeEach(() => {
  vi.clearAllMocks();
  selectMock.mockReturnValue({ eq: eqSelectMock });
  eqSelectMock.mockReturnValue({ maybeSingle: maybeSingleMock });
  updateMock.mockReturnValue({ eq: eqUpdateMock });
  eqUpdateMock.mockResolvedValue({ error: null });
});

describe("markConnectionFailure", () => {
  it("increments consecutive_failures from existing value", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { consecutive_failures: 2 }, error: null });
    await markConnectionFailure("conn-1", "fetch", new Error("boom"));
    expect(updateMock).toHaveBeenCalledTimes(1);
    const payload = updateMock.mock.calls[0][0];
    expect(payload.consecutive_failures).toBe(3);
    expect(payload.last_error_message).toContain("[fetch]");
    expect(payload.last_error_message).toContain("boom");
    expect(typeof payload.last_error_at).toBe("string");
  });

  it("starts at 1 when no prior failures", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null });
    await markConnectionFailure("conn-1", "connect", new Error("nope"));
    expect(updateMock.mock.calls[0][0].consecutive_failures).toBe(1);
  });

  it("redacts Bearer tokens and JWTs from error message", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { consecutive_failures: 0 }, error: null });
    const err = new Error("Unauthorized: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature failed");
    await markConnectionFailure("conn-1", "graph-api", err);
    const payload = updateMock.mock.calls[0][0];
    expect(payload.last_error_message).not.toContain("eyJhbGciOiJIUzI1NiJ9");
    expect(payload.last_error_message).toContain("[redacted]");
  });

  it("truncates very long error messages to 500 chars", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { consecutive_failures: 0 }, error: null });
    const longErr = new Error("X".repeat(2000));
    await markConnectionFailure("conn-1", "fetch", longErr);
    expect(updateMock.mock.calls[0][0].last_error_message.length).toBeLessThanOrEqual(500);
  });

  it("does not throw when supabase read fails", async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: { message: "db down" } });
    await expect(markConnectionFailure("conn-1", "fetch", new Error("x"))).resolves.toBeUndefined();
    expect(updateMock).not.toHaveBeenCalled();
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
