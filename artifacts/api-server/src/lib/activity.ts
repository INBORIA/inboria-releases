import { supabaseAdmin } from "./supabase";

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message?: string;
  emailId?: number;
  triggeredBy?: string;
}) {
  try {
    if (params.userId === params.triggeredBy) return;

    await supabaseAdmin.from("notifications").insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message || null,
      email_id: params.emailId || null,
      triggered_by: params.triggeredBy || null,
    });
  } catch (e) {
    console.error("Failed to create notification:", e);
  }
}

export async function logActivity(params: {
  organisationId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from("activity_logs").insert({
      organisation_id: params.organisationId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId || null,
      details: params.details || {},
    });
  } catch (e) {
    console.error("Failed to log activity:", e);
  }
}

export async function getOrgIdForUser(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();
  return data?.organisation_id || null;
}

export async function getUserName(userId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single();
  return data?.full_name || "Un collègue";
}
