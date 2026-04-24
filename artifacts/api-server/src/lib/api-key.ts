import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "ibk_";

export function generateApiKey(): { plain: string; prefix: string; hash: string } {
  const random = randomBytes(28).toString("base64url");
  const plain = `${KEY_PREFIX}${random}`;
  const prefix = plain.slice(0, 10);
  const hash = createHash("sha256").update(plain).digest("hex");
  return { plain, prefix, hash };
}

export function hashApiKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function isApiKeyShape(s: string | undefined | null): boolean {
  return typeof s === "string" && s.startsWith(KEY_PREFIX) && s.length >= 20;
}
