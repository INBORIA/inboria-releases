import { createHmac, timingSafeEqual } from "crypto";

function safeEqualHex(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "hex");
    const bBuf = Buffer.from(b, "hex");
    if (aBuf.length === 0 || aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

function safeEqualBase64(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "base64");
    const bBuf = Buffer.from(b, "base64");
    if (aBuf.length === 0 || aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
}

export function verifyMetaSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!appSecret || !rawBody || !header) return false;
  const cleaned = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqualHex(cleaned, expected);
}

export function verifyTwilioSignature(
  fullUrl: string,
  params: Record<string, string>,
  header: string | undefined,
  authToken: string,
): boolean {
  if (!authToken || !header) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = fullUrl;
  for (const k of sortedKeys) {
    data += k + (params[k] ?? "");
  }
  const expected = createHmac("sha1", authToken).update(data).digest("base64");
  return safeEqualBase64(header, expected);
}

/**
 * Verify a HubSpot v3 webhook signature.
 * Per HubSpot docs: signature = base64(HMAC-SHA256(client_secret, METHOD + URI + body + timestamp)).
 * The header is base64-encoded (not hex). The X-HubSpot-Request-Timestamp must be within 5 minutes.
 */
export function verifyHubspotV3Signature(args: {
  method: string;
  url: string;
  rawBody: Buffer | undefined;
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  clientSecret: string;
  toleranceMs?: number;
  nowMs?: number;
}): boolean {
  const tolerance = args.toleranceMs ?? 5 * 60 * 1000;
  const now = args.nowMs ?? Date.now();
  if (!args.clientSecret || !args.rawBody || !args.signatureHeader || !args.timestampHeader) return false;

  const tsNum = Number(args.timestampHeader);
  if (!Number.isFinite(tsNum)) return false;
  if (Math.abs(now - tsNum) > tolerance) return false;

  const data = args.method + args.url + args.rawBody.toString("utf8") + args.timestampHeader;
  const expected = createHmac("sha256", args.clientSecret).update(data).digest("base64");
  return safeEqualBase64(args.signatureHeader, expected);
}

/**
 * Legacy fallback for older HubSpot signature schemes (X-HubSpot-Signature-256, hex HMAC of body).
 * Kept only for backwards compatibility — production use should rely on verifyHubspotV3Signature.
 */
export function verifyHubspotSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  appSecret: string,
): boolean {
  if (!appSecret || !rawBody || !header) return false;
  const cleaned = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  return safeEqualHex(cleaned, expected);
}

export function verifyPipedriveSignature(
  rawBody: Buffer | undefined,
  header: string | undefined,
  webhookSecret: string,
): boolean {
  if (!webhookSecret || !rawBody || !header) return false;
  const cleaned = header.startsWith("sha256=") ? header.slice(7) : header;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(cleaned, expected);
}
