#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { randomBytes } from "node:crypto";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BREVO_PASSWORD = process.env.BREVO_SMTP_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const EMAIL = "cynthiachanmiss@hotmail.com";
const FULL_NAME = "Cynthia Chan";
const ORG_NAME = "Cynthia Chan";
const PLAN = "business";
const SEATS = 3;
const QUOTA = 30000;
const FRONTEND_URL = "https://app.inboria.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateStrongPassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;
  const pick = (set) => set[randomBytes(1)[0] % set.length];
  let pw = pick(upper) + pick(lower) + pick(digits) + pick(symbols);
  for (let i = 0; i < 10; i++) pw += pick(all);
  return pw.split("").sort(() => randomBytes(1)[0] - 128).join("");
}

function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function main() {
  console.log(`[beta-cynthia] starting for ${EMAIL}`);

  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) { console.error("listUsers failed:", listErr.message); process.exit(1); }
  const existing = list.users.find(u => u.email?.toLowerCase() === EMAIL.toLowerCase());
  if (existing) {
    console.error(`[beta-cynthia] User already exists with id=${existing.id}. Aborting (idempotency).`);
    process.exit(2);
  }

  const password = generateStrongPassword();

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password,
    email_confirm: true,
    user_metadata: { full_name: FULL_NAME, country: "BE" },
  });
  if (createErr || !created?.user) {
    console.error("createUser failed:", createErr?.message);
    process.exit(1);
  }
  const userId = created.user.id;
  console.log(`[beta-cynthia] auth user created id=${userId}`);

  const slug = `${slugify(ORG_NAME)}-${Date.now().toString(36)}`;
  const { data: org, error: orgErr } = await supabase
    .from("organisations")
    .insert({
      name: ORG_NAME,
      slug,
      plan: PLAN,
      seats_total: SEATS,
      emails_quota: QUOTA,
      emails_used: 0,
      created_by: userId,
    })
    .select()
    .single();
  if (orgErr || !org) {
    console.error("organisation insert failed:", orgErr?.message);
    process.exit(1);
  }
  console.log(`[beta-cynthia] organisation created id=${org.id} slug=${org.slug}`);

  const profilePayload = {
    id: userId,
    full_name: FULL_NAME,
    plan: PLAN,
    seats: SEATS,
    emails_used: 0,
    emails_quota: QUOTA,
    organisation_id: org.id,
    country: "BE",
  };
  let { error: profileErr } = await supabase.from("profiles").upsert(profilePayload);
  if (profileErr && profileErr.message?.includes("country")) {
    delete profilePayload.country;
    ({ error: profileErr } = await supabase.from("profiles").upsert(profilePayload));
  }
  if (profileErr) {
    console.error("profile upsert failed:", profileErr.message);
    process.exit(1);
  }
  console.log(`[beta-cynthia] profile upserted`);

  const { error: memberErr } = await supabase
    .from("organisation_members")
    .insert({
      organisation_id: org.id,
      user_id: userId,
      role: "admin",
      status: "active",
    });
  if (memberErr) {
    console.error("organisation_members insert failed:", memberErr.message);
    process.exit(1);
  }
  console.log(`[beta-cynthia] organisation_members inserted (admin)`);

  let mailSent = false;
  let mailError = null;
  if (BREVO_PASSWORD) {
    try {
      const transporter = nodemailer.createTransport({
        host: "smtp-relay.brevo.com",
        port: 587,
        secure: false,
        auth: { user: "a74939001@smtp-brevo.com", pass: BREVO_PASSWORD },
      });
      await transporter.sendMail({
        from: '"Inboria" <noreply@inboria.com>',
        to: EMAIL,
        subject: "Bonjour Cynthia — Bienvenue dans le programme bêta Inboria",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0d1117; color: #ffffff; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #2d7dd2; margin: 0;">Inboria</h1>
              <p style="color: #8b9cb3; margin-top: 4px; font-size: 13px;">Email Autopilot pour PME</p>
            </div>

            <h2 style="color: #ffffff; text-align: center; font-weight: 600;">Bonjour Cynthia,</h2>

            <p style="color: #c9d1d9; line-height: 1.6;">
              J'ai le plaisir de t'inviter à rejoindre le <strong>programme bêta privé d'Inboria</strong>, notre nouvel assistant intelligent qui transforme la gestion des emails professionnels.
            </p>

            <p style="color: #c9d1d9; line-height: 1.6;">
              Inboria classe automatiquement tes mails, propose des brouillons de réponse, te rappelle les relances importantes, et te fait gagner plusieurs heures par semaine. Ton retour d'expérience nous est très précieux pour finaliser le produit.
            </p>

            <p style="color: #c9d1d9; line-height: 1.6;">
              Voici tes accès personnels :
            </p>

            <div style="background: #161b22; border: 1px solid #2d7dd2; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
              <p style="margin: 6px 0; color: #c9d1d9;"><strong>Email :</strong> ${EMAIL}</p>
              <p style="margin: 6px 0; color: #c9d1d9;"><strong>Mot de passe :</strong> <code style="background:#0d1117;color:#2d7dd2;padding:3px 8px;border-radius:4px;">${password}</code></p>
              <p style="margin: 6px 0; color: #8b9cb3; font-size: 13px;">Plan : Business — 30 000 crédits IA — 3 sièges équipe</p>
            </div>

            <div style="text-align: center; margin: 28px 0;">
              <a href="${FRONTEND_URL}/login" style="background: #2d7dd2; color: #ffffff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">
                Me connecter à Inboria
              </a>
            </div>

            <p style="color: #8b9cb3; font-size: 13px; line-height: 1.5;">
              Au premier login, tu pourras connecter ta boîte Outlook ou Gmail en quelques clics. Si tu as la moindre question, réponds simplement à ce mail, je suis là pour t'aider.
            </p>

            <hr style="border: none; border-top: 1px solid #1f2937; margin: 24px 0;" />

            <p style="color: #8b9cb3; font-size: 13px; text-align: center; margin: 0;">
              Merci d'avance pour ton aide précieuse,<br/>
              <strong style="color: #ffffff;">L'équipe Inboria</strong>
            </p>

            <p style="color: #6e7681; font-size: 11px; text-align: center; margin-top: 16px;">
              Pense à changer ton mot de passe après ta première connexion (Paramètres → Sécurité).
            </p>
          </div>
        `,
      });
      mailSent = true;
      console.log(`[beta-cynthia] welcome email sent to ${EMAIL}`);
    } catch (e) {
      mailError = e?.message || String(e);
      console.error("[beta-cynthia] email send failed:", mailError);
    }
  } else {
    mailError = "BREVO_SMTP_PASSWORD not set";
    console.warn("[beta-cynthia] BREVO_SMTP_PASSWORD missing — email not sent");
  }

  console.log("\n=========================================");
  console.log("BETA ACCOUNT CREATED");
  console.log("=========================================");
  console.log(`Email     : ${EMAIL}`);
  console.log(`Password  : ${password}`);
  console.log(`User ID   : ${userId}`);
  console.log(`Org ID    : ${org.id}`);
  console.log(`Plan      : ${PLAN}`);
  console.log(`Quota     : ${QUOTA} crédits`);
  console.log(`Sièges    : ${SEATS}`);
  console.log(`Mail sent : ${mailSent ? "OUI" : "NON (" + mailError + ")"}`);
  console.log("=========================================\n");
}

main().catch((e) => {
  console.error("[beta-cynthia] fatal:", e);
  process.exit(1);
});
