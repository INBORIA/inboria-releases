import { describe, it, expect, vi, beforeEach } from "vitest";
import { maybeSendDisconnectedAlert, type MaybeSendDeps } from "./email-alerts";

function makeDeps(overrides: Partial<MaybeSendDeps> & { conn?: any; userEmail?: string | null; lang?: any; claimResult?: boolean } = {}): MaybeSendDeps & { sendMock: ReturnType<typeof vi.fn>; claimMock: ReturnType<typeof vi.fn>; revertMock: ReturnType<typeof vi.fn>; notifMock: ReturnType<typeof vi.fn> } {
  const sendMock = vi.fn().mockResolvedValue({ messageId: "m1" });
  const claimMock = vi.fn().mockResolvedValue(overrides.claimResult ?? true);
  const revertMock = vi.fn().mockResolvedValue(undefined);
  const notifMock = vi.fn().mockResolvedValue(undefined);
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
    claimAlertSlot: claimMock,
    revertAlertSlot: revertMock,
    createNotification: notifMock,
    now: overrides.now,
    frontendUrl: "https://inboria.test",
    sendMock,
    claimMock,
    revertMock,
    notifMock,
  } as any;
}

describe("maybeSendDisconnectedAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends alert when failures >= 3 and no previous alert", async () => {
    const deps = makeDeps();
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(true);
    expect(deps.sendMock).toHaveBeenCalledOnce();
    expect(deps.claimMock).toHaveBeenCalledWith("c1", expect.objectContaining({ nowIso: expect.any(String), cutoffIso: expect.any(String) }));
    expect(deps.revertMock).not.toHaveBeenCalled();
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

  it("respects 7-day cooldown via pre-check (skips before claim)", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const deps = makeDeps({ conn: { id: "c1", user_id: "u1", email_address: "x@y.z", consecutive_failures: 5, last_error_message: "fail", last_alert_sent_at: threeDaysAgo } });
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("cooldown");
    expect(deps.sendMock).not.toHaveBeenCalled();
    expect(deps.claimMock).not.toHaveBeenCalled();
  });

  it("respects cooldown atomically when claim returns false (race lost)", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const deps = makeDeps({
      conn: { id: "c1", user_id: "u1", email_address: "x@y.z", consecutive_failures: 5, last_error_message: "fail", last_alert_sent_at: eightDaysAgo },
      claimResult: false,
    });
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("cooldown");
    expect(deps.claimMock).toHaveBeenCalledOnce();
    expect(deps.sendMock).not.toHaveBeenCalled();
    expect(deps.notifMock).not.toHaveBeenCalled();
    expect(deps.revertMock).not.toHaveBeenCalled();
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

  it("returns error reason and reverts the slot if transporter fails (no previous alert)", async () => {
    const deps = makeDeps();
    (deps.transporter as any).sendMail = vi.fn().mockRejectedValue(new Error("smtp down"));
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("error");
    expect(deps.claimMock).toHaveBeenCalledOnce();
    expect(deps.revertMock).toHaveBeenCalledWith("c1", null);
    expect(deps.notifMock).not.toHaveBeenCalled();
  });

  it("reverts the slot to the previous timestamp on send failure (re-send case)", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const deps = makeDeps({ conn: { id: "c1", user_id: "u1", email_address: "x@y.z", consecutive_failures: 5, last_error_message: "fail", last_alert_sent_at: eightDaysAgo } });
    (deps.transporter as any).sendMail = vi.fn().mockRejectedValue(new Error("smtp down"));
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(false);
    expect(result.reason).toBe("error");
    expect(deps.revertMock).toHaveBeenCalledWith("c1", eightDaysAgo);
  });

  it("inserts an in-app notification when alert is sent", async () => {
    const deps = makeDeps();
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(true);
    expect(deps.notifMock).toHaveBeenCalledOnce();
    const arg = deps.notifMock.mock.calls[0]![0];
    expect(arg.userId).toBe("u1");
    expect(arg.title).toMatch(/boite@example\.com/);
    expect(arg.title).toMatch(/deconnectee/i);
    expect(arg.message).toMatch(/Parametres/);
  });

  it("does not insert an in-app notification when below threshold", async () => {
    const deps = makeDeps({ conn: { id: "c1", user_id: "u1", email_address: "x@y.z", consecutive_failures: 1, last_error_message: "fail", last_alert_sent_at: null } });
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(false);
    expect(deps.notifMock).not.toHaveBeenCalled();
  });

  it("still reports sent=true even if notification insert fails", async () => {
    const deps = makeDeps();
    deps.createNotification = vi.fn().mockRejectedValue(new Error("db down"));
    const result = await maybeSendDisconnectedAlert("c1", deps);
    expect(result.sent).toBe(true);
    expect(deps.sendMock).toHaveBeenCalledOnce();
    expect(deps.claimMock).toHaveBeenCalledOnce();
    expect(deps.revertMock).not.toHaveBeenCalled();
  });

  it("uses English notification copy when lang=en", async () => {
    const deps = makeDeps({ lang: "en" });
    await maybeSendDisconnectedAlert("c1", deps);
    const arg = deps.notifMock.mock.calls[0]![0];
    expect(arg.title).toMatch(/disconnected/i);
    expect(arg.message).toMatch(/Settings/);
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
