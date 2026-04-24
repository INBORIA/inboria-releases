import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  verifyMetaSignature,
  verifyTwilioSignature,
  verifyHubspotSignature,
  verifyHubspotV3Signature,
  verifyPipedriveSignature,
} from "./webhook-signatures";

describe("verifyMetaSignature", () => {
  const secret = "meta-app-secret";
  const body = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");

  it("accepts a valid signature", () => {
    expect(verifyMetaSignature(body, sig, secret)).toBe(true);
  });
  it("rejects a tampered body", () => {
    const tampered = Buffer.from(JSON.stringify({ object: "spoofed" }));
    expect(verifyMetaSignature(tampered, sig, secret)).toBe(false);
  });
  it("rejects when no secret/header/body", () => {
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(undefined, sig, secret)).toBe(false);
    expect(verifyMetaSignature(body, sig, "")).toBe(false);
  });
  it("accepts the bare hex form (no sha256= prefix)", () => {
    const bare = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyMetaSignature(body, bare, secret)).toBe(true);
  });
});

describe("verifyTwilioSignature", () => {
  const authToken = "twilio-auth-token";
  const url = "https://example.com/api/messaging/sms/twilio/webhook";
  const params = { To: "+15551234567", From: "+15559876543", Body: "Hello", MessageSid: "SM123" };
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const k of sortedKeys) data += k + (params as any)[k];
  const sig = createHmac("sha1", authToken).update(data).digest("base64");

  it("accepts a valid signature", () => {
    expect(verifyTwilioSignature(url, params, sig, authToken)).toBe(true);
  });
  it("rejects a tampered URL", () => {
    expect(verifyTwilioSignature(url + "/extra", params, sig, authToken)).toBe(false);
  });
  it("rejects tampered params", () => {
    expect(
      verifyTwilioSignature(url, { ...params, Body: "Spoofed" }, sig, authToken),
    ).toBe(false);
  });
  it("rejects empty header", () => {
    expect(verifyTwilioSignature(url, params, undefined, authToken)).toBe(false);
  });
});

describe("verifyHubspotSignature & verifyPipedriveSignature", () => {
  const body = Buffer.from(JSON.stringify([{ portalId: 12345, eventId: 1 }]));

  it("HubSpot signature round-trip", () => {
    const secret = "hub-app-secret";
    const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyHubspotSignature(body, sig, secret)).toBe(true);
    expect(verifyHubspotSignature(body, sig, "wrong")).toBe(false);
  });
  it("Pipedrive signature round-trip", () => {
    const secret = "pd-webhook-secret";
    const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyPipedriveSignature(body, sig, secret)).toBe(true);
    const corrupted = "sha256=" + createHmac("sha256", "wrong-secret").update(body).digest("hex");
    expect(verifyPipedriveSignature(body, corrupted, secret)).toBe(false);
  });
});

describe("verifyHubspotV3Signature", () => {
  const clientSecret = "hub-client-secret";
  const method = "POST";
  const url = "https://api.example.com/api/integrations/hubspot/webhook";
  const rawBody = Buffer.from(JSON.stringify([{ portalId: 99, eventId: 7 }]));
  const now = 1_700_000_000_000;
  const ts = String(now);
  const data = method + url + rawBody.toString("utf8") + ts;
  const sig = createHmac("sha256", clientSecret).update(data).digest("base64");

  it("accepts a valid v3 signature within the timestamp tolerance", () => {
    expect(
      verifyHubspotV3Signature({
        method,
        url,
        rawBody,
        signatureHeader: sig,
        timestampHeader: ts,
        clientSecret,
        nowMs: now,
      }),
    ).toBe(true);
  });

  it("rejects when the body is tampered", () => {
    const tampered = Buffer.from(JSON.stringify([{ portalId: 99, eventId: "spoofed" }]));
    expect(
      verifyHubspotV3Signature({
        method,
        url,
        rawBody: tampered,
        signatureHeader: sig,
        timestampHeader: ts,
        clientSecret,
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("rejects when the URL or method differ", () => {
    expect(
      verifyHubspotV3Signature({
        method: "GET",
        url,
        rawBody,
        signatureHeader: sig,
        timestampHeader: ts,
        clientSecret,
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      verifyHubspotV3Signature({
        method,
        url: url + "?x=1",
        rawBody,
        signatureHeader: sig,
        timestampHeader: ts,
        clientSecret,
        nowMs: now,
      }),
    ).toBe(false);
  });

  it("rejects timestamps older than the 5-minute tolerance", () => {
    expect(
      verifyHubspotV3Signature({
        method,
        url,
        rawBody,
        signatureHeader: sig,
        timestampHeader: ts,
        clientSecret,
        nowMs: now + 6 * 60 * 1000,
      }),
    ).toBe(false);
  });

  it("rejects missing inputs", () => {
    expect(
      verifyHubspotV3Signature({
        method,
        url,
        rawBody: undefined,
        signatureHeader: sig,
        timestampHeader: ts,
        clientSecret,
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      verifyHubspotV3Signature({
        method,
        url,
        rawBody,
        signatureHeader: undefined,
        timestampHeader: ts,
        clientSecret,
        nowMs: now,
      }),
    ).toBe(false);
    expect(
      verifyHubspotV3Signature({
        method,
        url,
        rawBody,
        signatureHeader: sig,
        timestampHeader: undefined,
        clientSecret,
        nowMs: now,
      }),
    ).toBe(false);
  });
});
