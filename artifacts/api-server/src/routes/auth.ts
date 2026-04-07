import { Router, type IRouter } from "express";
import { supabaseAdmin } from "../lib/supabase";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { isAllowedCountry } from "../lib/eu-countries";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  try {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password, fullName, country } = parsed.data;

    if (!country || !isAllowedCountry(country)) {
      res.status(400).json({ error: "NCV Mail est actuellement disponible uniquement dans l'Union Europeenne, l'EEE et la Suisse." });
      return;
    }

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, country: country.toUpperCase() },
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    if (data.user) {
      await supabaseAdmin.from("profiles").upsert({
        id: data.user.id,
        full_name: fullName,
        country: country.toUpperCase(),
        plan: "essai",
        seats: 1,
        emails_used: 0,
        emails_quota: 100,
      });
    }

    res.status(201).json({
      user: {
        id: data.user?.id,
        email: data.user?.email,
        fullName,
        plan: "essai",
        seats: 1,
        emailsUsed: 0,
        emailsQuota: 100,
        createdAt: data.user?.created_at,
      },
      session: data.session,
    });
  } catch (err) {
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/auth/setup-profile", async (req, res): Promise<void> => {
  try {
    const { userId, fullName, country } = req.body;
    if (!userId) {
      res.status(400).json({ error: "userId requis" });
      return;
    }

    if (!country || !isAllowedCountry(country)) {
      res.status(400).json({ error: "Pays requis (UE/EEE/Suisse uniquement)." });
      return;
    }

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: fullName || "",
      country: country.toUpperCase(),
      plan: "essai",
      seats: 1,
      emails_used: 0,
      emails_quota: 100,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Profile setup failed" });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password } = parsed.data;

    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: "Email ou mot de passe invalide" });
      return;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: profile?.full_name || "",
        plan: profile?.plan ?? "essai",
        seats: profile?.seats ?? 1,
        emailsUsed: profile?.emails_used ?? 0,
        emailsQuota: profile?.emails_quota ?? 100,
        createdAt: data.user.created_at,
      },
      session: data.session,
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", req.userId!)
      .single();

    const authHeader = req.headers.authorization!;
    const token = authHeader.slice(7);
    const { data: userData } = await supabaseAdmin.auth.getUser(token);

    res.json({
      id: req.userId,
      email: userData.user?.email || "",
      fullName: profile?.full_name || "",
      plan: profile?.plan ?? "essai",
      seats: profile?.seats ?? 1,
      emailsUsed: profile?.emails_used ?? 0,
      emailsQuota: profile?.emails_quota ?? 100,
      createdAt: userData.user?.created_at || "",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get user info" });
  }
});

export default router;
