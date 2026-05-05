import { Router, type IRouter } from "express";
import nodemailer from "nodemailer";
import { supabaseAdmin } from "../lib/supabase";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { isAllowedCountry } from "../lib/eu-countries";

const router: IRouter = Router();

const RESET_LANGS = ["fr", "en", "nl", "de", "es", "it", "pt", "pl"] as const;
type ResetLang = (typeof RESET_LANGS)[number];

function resetEmailCopy(lang: ResetLang) {
  switch (lang) {
    case "en":
      return {
        tagline: "Email Autopilot for SMBs",
        heading: "Reset your password",
        body: "You requested a password reset for your Inboria account. Click the button below to choose a new password. This link expires in 1 hour.",
        cta: "Reset my password",
        footer: "If you did not request this, you can safely ignore this email — your password will not change.",
        subject: "Reset your Inboria password",
      };
    case "nl":
      return {
        tagline: "Email Autopilot voor KMO's",
        heading: "Wachtwoord opnieuw instellen",
        body: "U heeft het opnieuw instellen van uw Inboria-wachtwoord aangevraagd. Klik op de knop hieronder om een nieuw wachtwoord te kiezen. Deze link verloopt over 1 uur.",
        cta: "Mijn wachtwoord resetten",
        footer: "Als u dit niet heeft aangevraagd, kunt u deze e-mail negeren — uw wachtwoord blijft ongewijzigd.",
        subject: "Stel uw Inboria-wachtwoord opnieuw in",
      };
    case "de":
      return {
        tagline: "E-Mail-Autopilot für KMU",
        heading: "Passwort zurücksetzen",
        body: "Sie haben das Zurücksetzen Ihres Inboria-Passworts angefordert. Klicken Sie auf die Schaltfläche unten, um ein neues Passwort festzulegen. Dieser Link ist 1 Stunde gültig.",
        cta: "Mein Passwort zurücksetzen",
        footer: "Wenn Sie dies nicht angefordert haben, können Sie diese E-Mail ignorieren — Ihr Passwort bleibt unverändert.",
        subject: "Setzen Sie Ihr Inboria-Passwort zurück",
      };
    case "es":
      return {
        tagline: "Email Autopilot para PyMEs",
        heading: "Restablecer su contraseña",
        body: "Ha solicitado restablecer la contraseña de su cuenta Inboria. Haga clic en el botón a continuación para elegir una nueva contraseña. Este enlace caduca en 1 hora.",
        cta: "Restablecer mi contraseña",
        footer: "Si no ha realizado esta solicitud, puede ignorar este correo — su contraseña no se modificará.",
        subject: "Restablezca su contraseña de Inboria",
      };
    case "it":
      return {
        tagline: "Email Autopilot per le PMI",
        heading: "Reimposta la sua password",
        body: "Ha richiesto la reimpostazione della password del suo account Inboria. Clicchi sul pulsante qui sotto per scegliere una nuova password. Questo link scade tra 1 ora.",
        cta: "Reimposta la mia password",
        footer: "Se non ha effettuato questa richiesta, puo ignorare questa email — la sua password non verra modificata.",
        subject: "Reimposti la sua password Inboria",
      };
    case "pt":
      return {
        tagline: "Email Autopilot para PMEs",
        heading: "Redefinir a sua palavra-passe",
        body: "Solicitou a redefinição da palavra-passe da sua conta Inboria. Clique no botão abaixo para escolher uma nova palavra-passe. Este link expira em 1 hora.",
        cta: "Redefinir a minha palavra-passe",
        footer: "Se não foi você quem fez este pedido, pode ignorar este email — a sua palavra-passe não será alterada.",
        subject: "Redefina a sua palavra-passe Inboria",
      };
    case "pl":
      return {
        tagline: "Email Autopilot dla MŚP",
        heading: "Zresetuj swoje hasło",
        body: "Otrzymaliśmy prośbę o zresetowanie hasła do Pana/Pani konta Inboria. Proszę kliknąć przycisk poniżej, aby wybrać nowe hasło. Ten link wygasa za 1 godzinę.",
        cta: "Zresetuj moje hasło",
        footer: "Jeśli to nie Pan/Pani złożył(a) tę prośbę, można zignorować tę wiadomość — hasło pozostanie bez zmian.",
        subject: "Zresetuj swoje hasło Inboria",
      };
    default:
      return {
        tagline: "Email Autopilot pour PME",
        heading: "Réinitialisation de votre mot de passe",
        body: "Vous avez demandé la réinitialisation du mot de passe de votre compte Inboria. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien expire dans 1 heure.",
        cta: "Réinitialiser mon mot de passe",
        footer: "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce message — votre mot de passe restera inchangé.",
        subject: "Réinitialisez votre mot de passe Inboria",
      };
  }
}

function renderResetEmailHtml(actionUrl: string, lang: ResetLang): string {
  const t = resetEmailCopy(lang);
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #0d1117; color: #ffffff; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2d7dd2; margin: 0;">Inboria</h1>
        <p style="color: #8b9cb3; margin-top: 5px;">${t.tagline}</p>
      </div>
      <h2 style="color: #ffffff; text-align: center;">${t.heading}</h2>
      <p style="color: #c9d1d9; line-height: 1.6;">${t.body}</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${actionUrl}" style="background: #2d7dd2; color: #ffffff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
          ${t.cta}
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #1f2937; margin: 20px 0;" />
      <p style="color: #6e7681; font-size: 12px; text-align: center;">${t.footer}</p>
    </div>
  `;
}

let cachedResetTransporter: nodemailer.Transporter | null = null;
function getResetTransporter(): nodemailer.Transporter | null {
  if (cachedResetTransporter) return cachedResetTransporter;
  const password = process.env["BREVO_SMTP_PASSWORD"];
  if (!password) return null;
  cachedResetTransporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: {
      user: "a74939001@smtp-brevo.com",
      pass: password,
    },
  });
  return cachedResetTransporter;
}

router.post("/auth/send-password-reset", async (req, res): Promise<void> => {
  try {
    const email = String(req.body?.email || "").toLowerCase().trim();
    const redirectTo = String(req.body?.redirectTo || "");
    const langRaw = String(req.body?.lang || "fr").toLowerCase();
    const lang: ResetLang = (RESET_LANGS as readonly string[]).includes(langRaw)
      ? (langRaw as ResetLang)
      : "fr";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "invalid_email" });
      return;
    }
    if (!redirectTo || !/^https?:\/\//i.test(redirectTo)) {
      res.status(400).json({ error: "invalid_redirect" });
      return;
    }
    let redirectHost = "";
    try {
      redirectHost = new URL(redirectTo).hostname.toLowerCase();
    } catch {
      res.status(400).json({ error: "invalid_redirect" });
      return;
    }
    const productionHostSuffixes = ["inboria.com", "ncvmail.com"];
    const devHostSuffixes = ["replit.app", "replit.dev", "picard.replit.dev"];
    const allowedHostSuffixes =
      process.env["NODE_ENV"] === "production"
        ? productionHostSuffixes
        : [...productionHostSuffixes, ...devHostSuffixes];
    const isAllowedHost =
      (process.env["NODE_ENV"] !== "production" && redirectHost === "localhost") ||
      allowedHostSuffixes.some((s) => redirectHost === s || redirectHost.endsWith("." + s));
    if (!isAllowedHost) {
      res.status(400).json({ error: "invalid_redirect" });
      return;
    }

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      req.log.info(
        { email, err: linkErr?.message },
        "send-password-reset: no link generated (likely unknown email)",
      );
      res.status(200).json({ ok: true });
      return;
    }

    const transporter = getResetTransporter();
    if (!transporter) {
      req.log.error("BREVO_SMTP_PASSWORD missing — cannot send reset email");
      res.status(200).json({ ok: true });
      return;
    }

    try {
      const info = await transporter.sendMail({
        from: '"Inboria" <jj.neybergh@gmail.com>',
        to: email,
        subject: resetEmailCopy(lang).subject,
        html: renderResetEmailHtml(linkData.properties.action_link, lang),
      });
      req.log.info(
        {
          email,
          lang,
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          response: info.response,
          envelope: info.envelope,
        },
        "send-password-reset: email handed off to Brevo",
      );
    } catch (sendErr: any) {
      req.log.error(
        { email, err: sendErr?.message },
        "send-password-reset: Brevo sendMail failed",
      );
    }

    res.status(200).json({ ok: true });
  } catch (err: any) {
    req.log.error({ err: err?.message }, "send-password-reset: unexpected error");
    res.status(200).json({ ok: true });
  }
});

router.post("/auth/register", async (req, res): Promise<void> => {
  try {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { email, password, fullName, country } = parsed.data;

    if (!country || !isAllowedCountry(country)) {
      res.status(400).json({ error: "Inboria est actuellement disponible uniquement dans l'Union Europeenne, l'EEE et la Suisse." });
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
      const profileData: Record<string, unknown> = {
        id: data.user.id,
        full_name: fullName,
        plan: "essai",
        seats: 1,
        emails_used: 0,
        emails_quota: 100,
      };
      if (country) {
        profileData.country = country.toUpperCase();
      }
      const { error: profileError } = await supabaseAdmin.from("profiles").upsert(profileData);
      if (profileError && profileError.message?.includes("country")) {
        delete profileData.country;
        await supabaseAdmin.from("profiles").upsert(profileData);
      }
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
      session: (data as any).session,
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

    const profileData: Record<string, unknown> = {
      id: userId,
      full_name: fullName || "",
      plan: "essai",
      seats: 1,
      emails_used: 0,
      emails_quota: 100,
    };
    if (country) {
      profileData.country = country.toUpperCase();
    }

    const { error } = await supabaseAdmin.from("profiles").upsert(profileData);

    if (error) {
      console.error("Profile upsert error:", error.message, error.details, error.code);
      if (error.message?.includes("country")) {
        const { error: retryError } = await supabaseAdmin.from("profiles").upsert({
          id: userId,
          full_name: fullName || "",
          plan: "essai",
          seats: 1,
          emails_used: 0,
          emails_quota: 100,
        });
        if (retryError) {
          console.error("Profile upsert retry error:", retryError.message);
          res.status(500).json({ error: "Erreur lors de la creation du profil: " + retryError.message });
          return;
        }
      } else {
        res.status(500).json({ error: "Erreur lors de la creation du profil: " + error.message });
        return;
      }
    }

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
      session: (data as any).session,
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
