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

const text = `Coucou Cynthia,

J'espère que tu vas bien.

Je t'écris parce que je viens de lancer mon application, Inboria — un assistant intelligent qui aide à gérer sa boîte mail au quotidien (tri automatique, brouillons de réponse, rappels de relance...).

On est en phase bêta privée et j'aimerais énormément avoir ton avis franc. Pas d'obligation, pas d'engagement, juste tester quand tu as 10 minutes et me dire ce qui te plaît, ce qui te bloque, ce qui manque.

Je t'ai créé un compte avec accès complet (plan Business, gratuit pendant toute la bêta) :

Site : ${SITE}
Email : ${EMAIL}
Mot de passe : ${PASSWORD}

N'hésite pas à me répondre directement à ce mail si tu as la moindre question, ou si quelque chose te chiffonne pendant l'utilisation.

Merci d'avance, ça me touche que tu prennes le temps 🙏

Bien à toi,
Jean-Jacques
`;

const html = `
<div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 24px; color: #1f2937; line-height: 1.6; font-size: 15px;">

  <p>Coucou Cynthia,</p>

  <p>J'espère que tu vas bien.</p>

  <p>
    Je t'écris parce que je viens de lancer mon application, <strong>Inboria</strong> — un assistant intelligent qui aide à gérer sa boîte mail au quotidien (tri automatique, brouillons de réponse, rappels de relance…).
  </p>

  <p>
    On est en phase bêta privée et <strong>j'aimerais énormément avoir ton avis franc</strong>. Pas d'obligation, pas d'engagement, juste tester quand tu as 10 minutes et me dire ce qui te plaît, ce qui te bloque, ce qui manque.
  </p>

  <p>
    Je t'ai créé un compte avec accès complet (plan Business, gratuit pendant toute la bêta) :
  </p>

  <p style="margin: 16px 0;">
    Site : <a href="${SITE}" style="color: #2d7dd2;">${SITE}</a><br/>
    Email : ${EMAIL}<br/>
    Mot de passe : <strong>${PASSWORD}</strong>
  </p>

  <p>
    N'hésite pas à me répondre directement à ce mail si tu as la moindre question, ou si quelque chose te chiffonne pendant l'utilisation.
  </p>

  <p>Merci d'avance, ça me touche que tu prennes le temps 🙏</p>

  <p>
    Bien à toi,<br/>
    <strong>Jean-Jacques</strong>
  </p>

</div>
`;

await transporter.sendMail({
  from: '"Jean-Jacques (Inboria)" <noreply@inboria.com>',
  to: EMAIL,
  subject: "Coucou Cynthia, j'aurais besoin de toi 🙏",
  text,
  html,
});

console.log(`[beta-welcome] sent to ${EMAIL}`);
