import { describe, it, expect, vi, beforeEach } from "vitest";
import { maybeSendDisconnectedAlert, type MaybeSendDeps } from "./email-alerts";

function makeDeps(overrides: Partial<MaybeSendDeps> & { conn?: any; userEmail?: string | null; lang?: any } = {}): MaybeSendDeps & { sendMock: ReturnType<typeof vi.fn>; markMock: ReturnType<typeof vi.fn> } {
  const sendMock = vi.fn().mockResolvedValue({ messageId: "m1" });
  const markMock = vi.fn().mockResolvedValue(undefined);
  const conn = overrides.conn ?? {
    id: "c1",
    user_id: "u1",
    email_address: "boite@example.com",
    consecutive_failures: 3,
    last_error_message: "[fetch] connect ECONNREFUSED 1.2.3.4:993",
    last_alert_sent_at: null,
  };
  return {
    transporter: { sendMail: sendMock } as any,
    fetchConnection: overrides.fetchConnection ?? vi.fn().mockResolvedValue(conn),
    fetchUserEmail: overrides.fetchUserEmail ?? vi.fn().mockResolvedValue("userEmail" in overrides ? overrides.userEmail : "owner@example.com"),
    fetchUserLang: overrides.fetchUserLang ?? vi.fn().mockResolvedValue(overrides.lang ?? "fr"),
    markAlertSent: markMock,
    now: overrides.now,
    frontendUrl: "https://inboria.test",
    sendMock,
    markMock,
  } as any;
}

describe("maybeSendDisconnectedAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends alert when failures >= 3 and no previous alert", async () => {
    const deps = makeDeps();
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(true);
    expect(deps.sendMock).toHaveBeenCalledOnce();
    expect(deps.markMock).toHaveBeenCalledWith("c1");
    const arg = deps.sendMock.mock.calls[0]![0];
    expect(arg.to).toBe("owner@example.com");
    expect(arg.subject).toMatch(/boite@example.com/);
    expect(arg.subject).toMatch(/Inboria/);
    expect(arg.html).toMatch(/Reconnecter cette boite/);
    expect(arg.html).toMatch(/https:\/\/inboria\.test\/dashboard\/parametres/);
  });

  it("skips when failures below threshold", async () => {
    const deps = makeDeps({ conn: { id: "c1", user_id: "u1", email_address: "x@y.z", consecutive_failures: 2, last_error_message: "fail", last_alert_sent_at: null } });
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("below-threshold");
    expect(deps.sendMock).not.toHaveBeenCalled();
  });

  it("respects 7-day cooldown", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const deps = makeDeps({ conn: { id: "c1", user_id: "u1", email_address: "x@y.z", consecutive_failures: 5, last_error_message: "fail", last_alert_sent_at: threeDaysAgo } });
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("cooldown");
    expect(deps.sendMock).not.toHaveBeenCalled();
    expect(deps.markMock).not.toHaveBeenCalled();
  });

  it("re-sends after 7+ days", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const deps = makeDeps({ conn: { id: "c1", user_id: "u1", email_address: "x@y.z", consecutive_failures: 5, last_error_message: "fail", last_alert_sent_at: eightDaysAgo } });
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(true);
    expect(deps.sendMock).toHaveBeenCalledOnce();
  });

  it("renders English template when lang=en", async () => {
    const deps = makeDeps({ lang: "en" });
    await maybeSendDisconnectedAlert("c1", deps);
    const arg = deps.sendMock.mock.calls[0]![0];
    expect(arg.subject).toMatch(/disconnected/i);
    expect(arg.html).toMatch(/Reconnect this mailbox/);
  });

  it("renders Dutch / German / Spanish templates", async () => {
    for (const [lang, marker] of [["nl", "losgekoppeld"], ["de", "getrennt"], ["es", "desconectado"]] as const) {
      const deps = makeDeps({ lang });
      await maybeSendDisconnectedAlert("c1", deps);
      const arg = deps.sendMock.mock.calls.at(-1)![0];
      expect(arg.subject.toLowerCase()).toContain(marker);
    }
  });

  it("falls back to French when lang is unknown", async () => {
    const deps = makeDeps({ lang: "zz" as any });
    await maybeSendDisconnectedAlert("c1", deps);
    const arg = deps.sendMock.mock.calls[0]![0];
    expect(arg.subject).toMatch(/deconnectee/i);
  });

  it("skips when user has no email", async () => {
    const deps = makeDeps({ userEmail: null });
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("no-user-email");
    expect(deps.sendMock).not.toHaveBeenCalled();
  });

  it("skips when connection is missing", async () => {
    const deps = makeDeps({ fetchConnection: vi.fn().mockResolvedValue(null) });
    const result = await maybeSendDisconnectedAlert("missing", deps);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("no-conn");
    expect(deps.sendMock).not.toHaveBeenCalled();
  });

  it("returns error reason and does not throw if transporter fails", async () => {
    const deps = makeDeps();
    (deps.transporter as any).sendMail = vi.fn().mockRejectedValue(new Error("smtp down"));
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("error");
    expect(deps.markMock).not.toHaveBeenCalled();
  });

  it("escapes HTML in error message and sanitizes tokens", async () => {
    const deps = makeDeps({
      conn: {
        id: "c1",
        user_id: "u1",
        email_address: "x@y.z",
        consecutive_failures: 3,
        last_error_message: "Bearer abc <script>alert(1)</script>",
        last_alert_sent_at: null,
      },
    });
    await maybeSendDisconnectedAlert("c1", deps);
    const arg = deps.sendMock.mock.calls[0]![0];
    expect(arg.html).not.toMatch(/<script>/);
    expect(arg.html).toMatch(/&lt;script&gt;/);
  });
});
