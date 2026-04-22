import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";

const router: IRouter = Router();

const ALLOWED_PLANS = ["solo", "pro", "business"] as const;
type WaitlistPlan = (typeof ALLOWED_PLANS)[number];

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

router.post("/waitlist", async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as {
    email?: unknown;
    plan?: unknown;
    seats?: unknown;
    locale?: unknown;
  };

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !isValidEmail(email) || email.length > 254) {
    res.status(400).json({ error: "invalid_email" });
    return;
  }

  let plan: WaitlistPlan | null = null;
  if (typeof body.plan === "string" && (ALLOWED_PLANS as readonly string[]).includes(body.plan)) {
    plan = body.plan as WaitlistPlan;
  }

  let seats: number | null = null;
  if (typeof body.seats === "number" && Number.isFinite(body.seats)) {
    seats = Math.max(1, Math.min(500, Math.floor(body.seats)));
  }

  const locale =
    typeof body.locale === "string" && body.locale.length <= 8 ? body.locale : null;

  const { error } = await supabaseAdmin.from("waitlist_signups").upsert(
    {
      email,
      plan,
      seats,
      locale,
    },
    { onConflict: "email" }
  );

  if (error) {
    res.status(500).json({ error: "save_failed" });
    return;
  }

  res.status(200).json({ success: true });
});

export default router;
