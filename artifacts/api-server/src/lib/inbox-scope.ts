import { supabaseAdmin } from "./supabase";

export async function getMemberMailboxIds(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("shared_mailbox_members")
    .select("shared_mailbox_id")
    .eq("user_id", userId);
  return (data || []).map((r: any) => r.shared_mailbox_id).filter(Boolean);
}

export function buildInboxScopeOrFilter(userId: string, memberMailboxIds: string[]): string {
  const personal = `and(user_id.eq.${userId},shared_mailbox_id.is.null)`;
  if (memberMailboxIds.length === 0) return personal;
  return `${personal},shared_mailbox_id.in.(${memberMailboxIds.join(",")})`;
}
