import { supabaseAdmin } from "./supabase";
import { logger } from "./logger";

interface OrgMembershipRow {
  organisation_id: string | null;
}

interface MemberIdRow {
  user_id: string | null;
}

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
  const row = data as OrgMembershipRow | null;
  return row?.organisation_id ?? null;
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
  const rows = (data || []) as unknown as MemberIdRow[];
  return rows.map((r) => String(r.user_id || "")).filter(Boolean);
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
  const row = data as OrgMembershipRow | null;
  return row?.organisation_id ?? null;
}

export type AdminAccessTargetType =
  | "contact"
  | "inbox_overview"
  | "inboria_memory"
  | "member_inbox";

interface AdminTeamAccessLogInsert {
  organisation_id: string;
  admin_user_id: string;
  target_type: AdminAccessTargetType;
  target_value: string | null;
  emails_seen_count: number;
  action: string;
  target_user_id?: string | null;
}

/**
 * Append an immutable line to admin_team_access_log. Never throws — failure
 * to log must not block the admin's read. We log a warning so the gap is
 * detectable in observability.
 */
// Cached at module level: once we detect the live DB has not yet been
// migrated with target_user_id (the column is missing), we stop trying to
// include it in the insert payload until the process restarts. This lets the
// audit trail keep working in the legacy schema (target_value heuristics)
// while the migration is being applied manually in Supabase.
let targetUserIdColumnAvailable = true;

export async function logAdminTeamAccess(params: {
  organisationId: string;
  adminUserId: string;
  targetType: AdminAccessTargetType;
  targetUserId?: string | null;
  targetValue?: string | null;
  emailsSeenCount?: number;
  action?: string;
}): Promise<void> {
  try {
    const basePayload: AdminTeamAccessLogInsert = {
      organisation_id: params.organisationId,
      admin_user_id: params.adminUserId,
      target_type: params.targetType,
      target_value: params.targetValue ?? null,
      emails_seen_count: params.emailsSeenCount ?? 0,
      action: params.action ?? "view",
    };
    const payload: AdminTeamAccessLogInsert = targetUserIdColumnAvailable
      ? { ...basePayload, target_user_id: params.targetUserId ?? null }
      : basePayload;
    const { error } = await supabaseAdmin.from("admin_team_access_log").insert(payload);
    if (
      error &&
      targetUserIdColumnAvailable &&
      typeof error.message === "string" &&
      /target_user_id|column.*does not exist|schema cache/i.test(error.message)
    ) {
      // Schema not migrated yet — disable the column for this process and
      // retry once with the legacy payload so the audit row still lands.
      targetUserIdColumnAvailable = false;
      logger.warn(
        { err: error.message },
        "[admin-team-access] target_user_id column missing — falling back to legacy payload (apply migrations/2026_05_01_admin_team_access.sql)",
      );
      const { error: retryErr } = await supabaseAdmin
        .from("admin_team_access_log")
        .insert(basePayload);
      if (retryErr) {
        logger.warn(
          { err: retryErr.message, target: params.targetType },
          "[admin-team-access] failed to write audit row (legacy retry)",
        );
      }
      return;
    }
    if (error) {
      logger.warn(
        { err: error.message, target: params.targetType },
        "[admin-team-access] failed to write audit row",
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(
      { err: message, target: params.targetType },
      "[admin-team-access] unexpected error writing audit row",
    );
  }
}
