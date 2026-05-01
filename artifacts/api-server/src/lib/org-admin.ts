import { supabaseAdmin } from "./supabase";
import { logger } from "./logger";

/**
 * Returns the organisation_id where the user is an active admin, or null.
 * "admin" here is the org admin (organisation_members.role = 'admin'), NOT
 * the Inboria platform superadmin (profiles.is_admin).
 */
export async function getOrgIdForOrgAdmin(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .eq("role", "admin")
    .maybeSingle();
  return (data as any)?.organisation_id || null;
}

/**
 * Returns all active member user_ids of an organisation (excluding members
 * marked as removed/inactive).
 */
export async function listOrgMemberIds(orgId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("user_id")
    .eq("organisation_id", orgId)
    .eq("status", "active");
  return (data || []).map((r: any) => String(r.user_id)).filter(Boolean);
}

/**
 * Returns the organisation_id of the user (any role), or null.
 */
export async function getOrgIdForMember(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data as any)?.organisation_id || null;
}

export type AdminAccessTargetType =
  | "contact"
  | "inbox_overview"
  | "inboria_memory"
  | "member_inbox";

/**
 * Append an immutable line to admin_team_access_log. Never throws — failure
 * to log must not block the admin's read. We log a warning so the gap is
 * detectable in observability.
 */
export async function logAdminTeamAccess(params: {
  organisationId: string;
  adminUserId: string;
  targetType: AdminAccessTargetType;
  targetValue?: string | null;
  emailsSeenCount?: number;
  action?: string;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("admin_team_access_log").insert({
      organisation_id: params.organisationId,
      admin_user_id: params.adminUserId,
      target_type: params.targetType,
      target_value: params.targetValue ?? null,
      emails_seen_count: params.emailsSeenCount ?? 0,
      action: params.action ?? "view",
    });
    if (error) {
      logger.warn(
        { err: error.message, target: params.targetType },
        "[admin-team-access] failed to write audit row",
      );
    }
  } catch (err: any) {
    logger.warn(
      { err: err?.message, target: params.targetType },
      "[admin-team-access] unexpected error writing audit row",
    );
  }
}
