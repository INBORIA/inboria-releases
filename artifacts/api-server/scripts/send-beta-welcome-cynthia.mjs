#!/usr/bin/env node
import nodemailer from "nodemailer";

const BREVO_PASSWORD = process.env.BREVO_SMTP_PASSWORD;
if (!BREVO_PASSWORD) {
  console.error("BREVO_SMTP_PASSWORD missing");
  process.exit(1);
}

const EMAIL = "cynthiachanmiss@hotmail.com";
const PASSWORD = "BdHtj99tJ!@rj@";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: { user: "a74939001@smtp-brevo.com", pass: BREVO_PASSWORD },
});

const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background: #ffffff; color: #1f2937; line-height: 1.6;">

  <div style="text-align: center; margin-bottom: 32px;">
    <h1 style="color: #2d7dd2; margin: 0; font-size: 32px; letter-spacing: -0.5px;">Inboria</h1>
    <p style="color: #6b7280; margin-top: 4px; font-size: 13px;">Email Autopilot pour PME</p>
  </div>

  <p style="font-size: 17px; color: #1f2937; margin: 0 0 16px;">
    Salut Cynthia,
  </p>

  <p style="font-size: 15px; color: #374151;">
    J'ai créé Inboria, un assistant intelligent qui aide les pros à reprendre le contrôle de leur boîte mail (tri automatique, brouillons IA, relances, etc.).
  </p>

  <p style="font-size: 15px; color: #374151;">
    On est en phase bêta privée, et <strong>j'aimerais beaucoup avoir ton avis</strong>. Aucune obligation, aucun engagement — juste tester quand tu as 10 minutes et me dire ce qui te plaît, ce qui te bloque, ce qui manque.
  </p>

  <p style="font-size: 15px; color: #374151; margin-top: 24px;">
    Voici tes identifiants :
  </p>

  <div style="background: #f3f4f6; border-left: 4px solid #2d7dd2; border-radius: 4px; padding: 16px 20px; margin: 12px 0 24px;">
    <p style="margin: 4px 0; font-size: 14px;"><strong>🌐 Site :</strong> <a href="https://inboria.com" style="color: #2d7dd2; text-decoration: none;">inboria.com</a></p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>📧 Email :</strong> ${EMAIL}</p>
    <p style="margin: 4px 0; font-size: 14px;"><strong>🔑 Mot de passe :</strong> <code style="background: #ffffff; color: #2d7dd2; padding: 3px 8px; border-radius: 4px; font-size: 13px;">${PASSWORD}</code></p>
  </div>

  <p style="font-size: 14px; color: #6b7280; margin-top: 16px;">
    Tu as accès au plan <strong>Business complet</strong>, gratuit pendant toute la bêta — pas de carte bancaire à donner.
  </p>

  <div style="text-align: center; margin: 32px 0;">
    <a href="https://inboria.com/login" style="background: #2d7dd2; color: #ffffff; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; display: inline-block;">
      Me connecter à Inboria
    </a>
  </div>

  <p style="font-size: 14px; color: #6b7280;">
    Tu peux répondre directement à ce mail si tu as la moindre question, ou si tu veux me partager un retour. Et n'hésite pas à changer ton mot de passe à la première connexion (Profil → Sécurité).
  </p>

  <p style="font-size: 15px; color: #1f2937; margin-top: 28px;">
    Merci d'avance pour ton aide, ça compte beaucoup 🙏
  </p>

  <p style="font-size: 15px; color: #1f2937; margin-top: 16px;">
    Bien à toi,<br/>
    <strong>Jean-Jacques</strong><br/>
    <span style="color: #6b7280; font-size: 13px;">Fondateur d'Inboria</span>
  </p>

  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;" />
  <p style="color: #9ca3af; font-size: 11px; text-align: center; margin: 0;">
    Inboria — <a href="https://inboria.com" style="color: #9ca3af;">inboria.com</a>
  </p>

</div>
`;

await transporter.sendMail({
  from: '"Jean-Jacques (Inboria)" <noreply@inboria.com>',
  to: EMAIL,
  subject: "Salut Cynthia — un petit coup de main pour tester Inboria ? 🙏",
  html,
});

console.log(`[beta-welcome] sent to ${EMAIL}`);
