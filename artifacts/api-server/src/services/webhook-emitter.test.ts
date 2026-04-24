import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";

const { fromMock, selectMock, eqEnabledMock, eqEventMock, eqUserMock, updateMock, eqUpdateMock } =
  vi.hoisted(() => ({
    fromMock: vi.fn(),
    selectMock: vi.fn(),
    eqUserMock: vi.fn(),
    eqEventMock: vi.fn(),
    eqEnabledMock: vi.fn(),
    updateMock: vi.fn(),
    eqUpdateMock: vi.fn(),
  }));

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: { from: fromMock },
}));

import { emitEvent } from "./webhook-emitter";

beforeEach(() => {
  vi.clearAllMocks();

  fromMock.mockImplementation(() => ({
    select: selectMock,
    update: updateMock,
  }));
  selectMock.mockReturnValue({ eq: eqUserMock });
  eqUserMock.mockReturnValue({ eq: eqEventMock });
  eqEventMock.mockReturnValue({ eq: eqEnabledMock });
  updateMock.mockReturnValue({ eq: eqUpdateMock });
  eqUpdateMock.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (process.env as any)["NODE_ENV"];
});

describe("emitEvent", () => {
  it("returns silently when no subscriptions exist", async () => {
    eqEnabledMock.mockResolvedValueOnce({ data: [] });
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any);
    await emitEvent("user-1", "task.created", { id: "t1" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POSTs the payload with HMAC signature when secret is set", async () => {
    eqEnabledMock.mockResolvedValueOnce({
      data: [
        {
          id: "sub-1",
          target_url: "https://example.com/hook",
          secret: "whsec_secret",
          failure_count: 0,
        },
      ],
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValue({ ok: true, status: 200 } as any);

    await emitEvent("user-1", "task.created", { id: "t1" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0] as [string, RequestInit];
    const [url, init] = call;
    expect(url).toBe("https://example.com/hook");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["X-Inboria-Event"]).toBe("task.created");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Inboria-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);

    const body = init.body as string;
    const expectedSig = "sha256=" + createHmac("sha256", "whsec_secret").update(body).digest("hex");
    expect(headers["X-Inboria-Signature"]).toBe(expectedSig);

    const parsed = JSON.parse(body);
    expect(parsed.type).toBe("task.created");
    expect(parsed.data).toEqual({ id: "t1" });
    expect(parsed.id).toMatch(/^evt_/);
  });

  it("blocks SSRF targets in production (loopback)", async () => {
    process.env["NODE_ENV"] = "production";
    eqEnabledMock.mockResolvedValueOnce({
      data: [
        {
          id: "sub-bad",
          target_url: "http://127.0.0.1:9999/hook",
          secret: null,
          failure_count: 0,
        },
      ],
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any);

    await emitEvent("user-1", "email.received", { id: "e1" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalled();
    const updatedWith = updateMock.mock.calls[0]?.[0] as any;
    expect(updatedWith.last_error).toBe("invalid target_url");
    expect(updatedWith.failure_count).toBe(1);
  });

  it("blocks SSRF targets in production (RFC1918 192.168)", async () => {
    process.env["NODE_ENV"] = "production";
    eqEnabledMock.mockResolvedValueOnce({
      data: [
        { id: "sub-bad", target_url: "http://192.168.1.5/hook", secret: null, failure_count: 0 },
      ],
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch" as any);
    await emitEvent("user-1", "email.received", { id: "e1" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("records failure_count when target returns 5xx", async () => {
    eqEnabledMock.mockResolvedValueOnce({
      data: [
        { id: "sub-1", target_url: "https://example.com/hook", secret: null, failure_count: 2 },
      ],
    });
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({ ok: false, status: 503 } as any);

    await emitEvent("user-1", "task.created", { id: "t1" });

    const updatedWith = updateMock.mock.calls[0]?.[0] as any;
    expect(updatedWith.failure_count).toBe(3);
    expect(updatedWith.last_error).toBe("HTTP 503");
  });
});
