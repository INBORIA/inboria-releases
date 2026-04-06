import { supabaseAdmin } from "../lib/supabase";

interface Integration {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  workspace_name: string | null;
  channel_id: string | null;
  database_id: string | null;
  enabled: boolean;
}

async function isProPlan(userId: string): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();
  return !!profile && profile.plan !== "essai" && profile.plan !== "expired" && profile.plan !== "solo";
}

export async function sendSlackNotification(
  userId: string,
  sender: string,
  subject: string,
  summary: string
): Promise<void> {
  try {
    if (!(await isProPlan(userId))) return;

    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "slack")
      .eq("enabled", true)
      .maybeSingle();

    if (!integration || !integration.access_token || !integration.channel_id) return;

    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: ":rotating_light: Email urgent", emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*De:*\n${sender}` },
          { type: "mrkdwn", text: `*Sujet:*\n${subject}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Resume IA:*\n${summary || "Aucun resume disponible"}` },
      },
    ];

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: integration.channel_id,
        text: `Email urgent de ${sender}: ${subject}`,
        blocks,
      }),
    });

    const result = await response.json() as { ok: boolean; error?: string };
    if (!result.ok) {
      console.error("[integrations] Slack notification error:", result.error);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[integrations] Slack notification failed:", message);
  }
}

export async function createNotionTask(
  userId: string,
  taskTitle: string,
  emailSubject: string,
  emailSender: string
): Promise<void> {
  try {
    if (!(await isProPlan(userId))) return;

    const { data: integration } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", "notion")
      .eq("enabled", true)
      .maybeSingle();

    if (!integration || !integration.access_token || !integration.database_id) return;

    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.access_token}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: integration.database_id },
        properties: {
          Name: {
            title: [{ text: { content: taskTitle } }],
          },
          ...(emailSubject ? {
            "Email": {
              rich_text: [{ text: { content: `${emailSender}: ${emailSubject}` } }],
            },
          } : {}),
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[integrations] Notion task creation error:", errBody);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[integrations] Notion task creation failed:", message);
  }
}

export async function getUserIntegrations(userId: string): Promise<Integration[]> {
  const { data } = await supabaseAdmin
    .from("integrations")
    .select("*")
    .eq("user_id", userId);

  return (data || []) as Integration[];
}
