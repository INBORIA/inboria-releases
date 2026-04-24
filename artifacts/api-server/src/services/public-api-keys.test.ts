import { describe, it, expect, vi } from "vitest";
import { createHash } from "crypto";

vi.mock("../lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { generateApiKey } from "./public-api-keys";

describe("generateApiKey", () => {
  it("returns a key with the ibk_ prefix", () => {
    const { plain, prefix } = generateApiKey();
    expect(plain.startsWith("ibk_")).toBe(true);
    expect(prefix).toBe(plain.slice(0, 10));
    expect(prefix.startsWith("ibk_")).toBe(true);
  });

  it("returns a hash that matches sha256 of the plain key", () => {
    const { plain, hash } = generateApiKey();
    const expected = createHash("sha256").update(plain).digest("hex");
    expect(hash).toBe(expected);
    expect(hash.length).toBe(64);
  });

  it("produces unique keys on each call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.plain).not.toBe(b.plain);
    expect(a.hash).not.toBe(b.hash);
  });

  it("encodes the random part with base64url (no +, /, =)", () => {
    const { plain } = generateApiKey();
    const tail = plain.slice(4);
    expect(tail).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
