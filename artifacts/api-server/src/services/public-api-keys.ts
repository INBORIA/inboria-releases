import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "../lib/supabase";

export interface PublicApiKeyRow {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

const KEY_PREFIX = "ibk_"; // Inboria Key

function hashKey(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

export function generateApiKey(): { plain: string; prefix: string; hash: string } {
  const random = randomBytes(24).toString("base64url");
  const plain = `${KEY_PREFIX}${random}`;
  return { plain, prefix: plain.slice(0, 10), hash: hashKey(plain) };
}

export async function createApiKey(
  userId: string,
  name: string,
  scopes: string[] = ["read", "write"],
): Promise<{ row: PublicApiKeyRow; plain: string }> {
  const { plain, prefix, hash } = generateApiKey();
  const { data, error } = await supabaseAdmin
    .from("public_api_keys")
    .insert({
      user_id: userId,
      name,
      key_prefix: prefix,
      key_hash: hash,
      scopes,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "Failed to create API key");

  return {
    plain,
    row: {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      keyPrefix: data.key_prefix,
      scopes: data.scopes,
      lastUsedAt: data.last_used_at,
      revokedAt: data.revoked_at,
      createdAt: data.created_at,
    },
  };
}

export async function listApiKeys(userId: string): Promise<PublicApiKeyRow[]> {
  const { data } = await supabaseAdmin
    .from("public_api_keys")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  return (data || []).map((d: any) => ({
    id: d.id,
    userId: d.user_id,
    name: d.name,
    keyPrefix: d.key_prefix,
    scopes: d.scopes,
    lastUsedAt: d.last_used_at,
    revokedAt: d.revoked_at,
    createdAt: d.created_at,
  }));
}

export async function revokeApiKey(userId: string, id: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("public_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
  return !error;
}

export interface ResolvedKey {
  userId: string;
  keyId: string;
  scopes: string[];
}

export async function resolveApiKey(plain: string): Promise<ResolvedKey | null> {
  if (!plain || !plain.startsWith(KEY_PREFIX)) return null;
  const hash = hashKey(plain);
  const { data } = await supabaseAdmin
    .from("public_api_keys")
    .select("id, user_id, scopes, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!data || data.revoked_at) return null;

  // Bump last_used_at non-blocking
  supabaseAdmin
    .from("public_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {});

  return { userId: data.user_id, keyId: data.id, scopes: data.scopes || [] };
}
