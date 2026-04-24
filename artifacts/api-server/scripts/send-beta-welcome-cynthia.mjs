#!/usr/bin/env node
import nodemailer from "nodemailer";

const BREVO_PASSWORD = process.env.BREVO_SMTP_PASSWORD;
if (!BREVO_PASSWORD) {
  console.error("BREVO_SMTP_PASSWORD missing");
  process.exit(1);
}

const EMAIL = "cynthiachanmiss@hotmail.com";
const PASSWORD = "BdHtj99tJ!@rj@";
const SITE = "https://inboria.com";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: { user: "a74939001@smtp-brevo.com", pass: BREVO_PASSWORD },
});

const text = `Salut Cynthia,

J'ai créé Inboria, un assistant intelligent qui aide les pros à reprendre le contrôle de leur boîte mail (tri automatique, brouillons IA, relances...).

On est en phase bêta privée et j'aimerais beaucoup avoir ton avis. Aucune obligation, aucun engagement — juste tester quand tu as 10 minutes et me dire ce que tu en penses.

==========================================
TES IDENTIFIANTS DE CONNEXION
==========================================

Site web :     ${SITE}
Email :        ${EMAIL}
Mot de passe : ${PASSWORD}

==========================================

Tu as accès au plan Business complet, gratuit pendant toute la bêta — pas de carte bancaire à donner, 30 000 crédits IA, jusqu'à 3 membres d'équipe.

Pour te connecter : ${SITE}/login

Tu peux répondre directement à ce mail si tu as la moindre question. Pense à changer ton mot de passe à la première connexion (Profil → Sécurité).

Merci d'avance pour ton aide, ça compte beaucoup 🙏

Bien à toi,
Jean-Jacques
Fondateur d'Inboria
`;

const html = `
<div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1f2937; line-height: 1.6;">

  <h1 style="color: #2d7dd2; margin: 0 0 8px;">Inboria</h1>
  <p style="color: #6b7280; margin: 0 0 24px; font-size: 13px;">Email Autopilot pour PME</p>

  <p style="font-size: 16px;">Salut Cynthia,</p>

  <p>
    J'ai créé <strong>Inboria</strong>, un assistant intelligent qui aide les pros à reprendre le contrôle de leur boîte mail (tri automatique, brouillons IA, relances…).
  </p>

  <p>
    On est en phase bêta privée, et <strong>j'aimerais beaucoup avoir ton avis</strong>. Aucune obligation, aucun engagement — juste tester quand tu as 10 minutes et me dire ce que tu en penses.
  </p>

  <h3 style="color: #1f2937; margin: 28px 0 12px; border-bottom: 2px solid #2d7dd2; padding-bottom: 6px;">
    Tes identifiants de connexion
  </h3>

  <table cellpadding="10" cellspacing="0" border="0" style="width: 100%; background: #f3f4f6; border-radius: 6px; font-family: Arial, sans-serif; font-size: 15px;">
    <tr>
      <td style="font-weight: bold; color: #1f2937; width: 130px;">Site web :</td>
      <td><a href="${SITE}" style="color: #2d7dd2;">${SITE}</a></td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #1f2937;">Email :</td>
      <td style="color: #1f2937;">${EMAIL}</td>
    </tr>
    <tr>
      <td style="font-weight: bold; color: #1f2937;">Mot de passe :</td>
      <td style="color: #1f2937; font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold;">${PASSWORD}</td>
    </tr>
  </table>

  <p style="margin-top: 20px;">
    Tu as accès au plan <strong>Business complet</strong> — gratuit pendant toute la bêta, sans carte bancaire, 30 000 crédits IA, jusqu'à 3 membres d'équipe.
  </p>

  <p style="text-align: center; margin: 32px 0;">
    <a href="${SITE}/login" style="background: #2d7dd2; color: #ffffff; padding: 14px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px;">
      Me connecter à Inboria
    </a>
  </p>

  <p style="font-size: 14px; color: #6b7280;">
    Tu peux répondre directement à ce mail si tu as la moindre question. Pense à changer ton mot de passe à la première connexion (<strong>Profil → Sécurité</strong>).
  </p>

  <p style="margin-top: 24px;">Merci d'avance pour ton aide, ça compte beaucoup 🙏</p>

  <p style="margin-top: 16px;">
    Bien à toi,<br/>
    <strong>Jean-Jacques</strong><br/>
    <span style="color: #6b7280; font-size: 13px;">Fondateur d'Inboria</span>
  </p>

</div>
`;

await transporter.sendMail({
  from: '"Jean-Jacques (Inboria)" <noreply@inboria.com>',
  to: EMAIL,
  subject: "Salut Cynthia — tes identifiants pour tester Inboria",
  text,
  html,
});

console.log(`[beta-welcome] sent to ${EMAIL}`);
