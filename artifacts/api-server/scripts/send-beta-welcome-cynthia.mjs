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
<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #0d1117; color: #c9d1d9; border-radius: 8px; line-height: 1.6;">

  <div style="text-align: center; margin-bottom: 28px;">
    <h1 style="color: #2d7dd2; margin: 0; font-size: 28px;">Inboria</h1>
    <p style="color: #8b9cb3; margin-top: 4px; font-size: 13px;">Email Autopilot pour PME</p>
  </div>

  <h2 style="color: #ffffff; font-weight: 600;">Bonjour Cynthia, et merci !</h2>

  <p>
    Tu as accepté de tester <strong>Inboria</strong> en avant-première — l'autopilote email pour les pros qui veulent reprendre le contrôle de leur boîte de réception. Ton retour va façonner le produit avant le lancement officiel.
  </p>

  <h3 style="color: #ffffff; margin-top: 28px;">🎁 Ton accès — gratuit pendant toute la bêta</h3>
  <p>
    Plan <strong>Business</strong> complet, sans carte bancaire, sans engagement.
  </p>
  <div style="background: #161b22; border: 1px solid #2d7dd2; border-radius: 8px; padding: 16px 20px; margin: 16px 0;">
    <p style="margin: 6px 0;"><strong>Email :</strong> ${EMAIL}</p>
    <p style="margin: 6px 0;"><strong>Mot de passe :</strong> <code style="background:#0d1117;color:#2d7dd2;padding:3px 8px;border-radius:4px;">${PASSWORD}</code></p>
    <p style="margin: 6px 0; color: #8b9cb3; font-size: 13px;">30 000 crédits IA — 3 sièges équipe</p>
  </div>

  <h3 style="color: #ffffff; margin-top: 28px;">💻 Version Web — Démarrer en 5 minutes</h3>
  <p style="margin: 6px 0;">1️⃣ Va sur <a href="https://inboria.com" style="color:#2d7dd2;">https://inboria.com</a></p>
  <p style="margin: 6px 0;">2️⃣ Connecte-toi avec les identifiants ci-dessus</p>
  <p style="margin: 6px 0;">3️⃣ Choisis ta langue en haut à droite (FR / EN / NL / DE / ES)</p>
  <p style="margin: 6px 0;">4️⃣ Va dans <strong>Paramètres → Boîtes mail → Connecter une boîte</strong></p>
  <p style="margin: 4px 0 4px 24px; color: #8b9cb3;">• Outlook 365 → 1 clic via Microsoft (le plus simple)</p>
  <p style="margin: 4px 0 4px 24px; color: #8b9cb3;">• Gmail / Yahoo / Telenet / Skynet… → mot de passe d'application requis</p>
  <p style="margin: 6px 0;">5️⃣ Ouvre un email reçu, clique sur <strong>"Générer une réponse IA"</strong> → magie ✨</p>

  <h3 style="color: #ffffff; margin-top: 28px;">📱 Version Mobile — Comme une vraie app sur ton téléphone</h3>
  <p>
    Pas besoin de passer par un store. Inboria s'installe directement sur ton écran d'accueil en 30 secondes.
  </p>

  <p style="margin-top: 16px;"><strong style="color:#ffffff;">🤖 Android (Chrome)</strong></p>
  <p style="margin: 4px 0 4px 16px;">• Ouvre <a href="https://inboria.com" style="color:#2d7dd2;">https://inboria.com</a> dans Chrome</p>
  <p style="margin: 4px 0 4px 16px;">• Touche le menu (⋮ en haut à droite)</p>
  <p style="margin: 4px 0 4px 16px;">• Choisis <strong>"Ajouter à l'écran d'accueil"</strong></p>
  <p style="margin: 4px 0 4px 16px;">• L'icône Inboria apparaît — touche-la, et c'est comme une vraie app ✨</p>

  <p style="margin-top: 16px;"><strong style="color:#ffffff;">🍏 iPhone / iPad (Safari)</strong></p>
  <p style="margin: 4px 0 4px 16px;">• Ouvre <a href="https://inboria.com" style="color:#2d7dd2;">https://inboria.com</a> dans Safari</p>
  <p style="margin: 4px 0 4px 16px;">• Touche l'icône Partage en bas (carré avec flèche ↑)</p>
  <p style="margin: 4px 0 4px 16px;">• Fais défiler et choisis <strong>"Sur l'écran d'accueil"</strong></p>
  <p style="margin: 4px 0 4px 16px;">• Confirme — l'icône Inboria apparaît, tu l'utilises comme n'importe quelle app</p>

  <p style="margin-top: 16px; color:#8b9cb3; font-size:13px;">
    💡 <strong>Conseil :</strong> commence par la version web sur ordinateur pour connecter ta boîte mail, puis installe l'icône sur ton téléphone — tes données sont automatiquement synchronisées.
  </p>

  <h3 style="color: #ffffff; margin-top: 28px;">🔒 Côté sécurité</h3>
  <p style="margin: 4px 0 4px 16px;">• Pense à changer ton mot de passe à la 1ʳᵉ connexion (<strong>Profil → Sécurité</strong>)</p>
  <p style="margin: 4px 0 4px 16px;">• Tes emails sont traités automatiquement par l'IA, jamais lus par un humain</p>
  <p style="margin: 4px 0 4px 16px;">• Données hébergées en Europe (RGPD)</p>
  <p style="margin: 4px 0 4px 16px;">• Tu peux révoquer l'accès et supprimer ton compte à tout moment</p>

  <h3 style="color: #ffffff; margin-top: 28px;">🎯 Ce qui m'intéresse particulièrement</h3>
  <p style="margin: 4px 0;">✅ Le tri automatique est-il pertinent pour ton activité ?</p>
  <p style="margin: 4px 0;">✅ La qualité des brouillons IA : ton, style, justesse ?</p>
  <p style="margin: 4px 0;">✅ L'ergonomie mobile : aussi fluide que prévu ?</p>
  <p style="margin: 4px 0;">✅ Y a-t-il des moments où tu te perds dans l'app ?</p>
  <p style="margin: 4px 0;">✅ Qu'est-ce qui te manquerait pour remplacer ton workflow actuel ?</p>

  <h3 style="color: #ffffff; margin-top: 28px;">🐛 Pour tes retours</h3>
  <p style="margin: 4px 0;">🔴 <strong>Bug bloquant</strong> → message direct, je traite dans la journée</p>
  <p style="margin: 4px 0;">🟡 <strong>Bug mineur ou suggestion</strong> → en privé</p>
  <p style="margin: 4px 0;">💡 <strong>Idée produit</strong> → tout est bon à prendre !</p>

  <p style="margin-top: 28px;">
    Encore merci, tu fais partie des toutes premières personnes à utiliser Inboria. C'est précieux. 🙏
  </p>

  <p style="margin-top: 16px;">
    Bon test !<br/>
    <strong style="color:#ffffff;">Jean-Jacques</strong>
  </p>

  <hr style="border: none; border-top: 1px solid #1f2937; margin: 24px 0;" />
  <p style="color: #6e7681; font-size: 11px; text-align: center; margin: 0;">
    Inboria — Email Autopilot pour PME — <a href="https://inboria.com" style="color:#6e7681;">inboria.com</a>
  </p>

</div>
`;

await transporter.sendMail({
  from: '"Inboria" <noreply@inboria.com>',
  to: EMAIL,
  subject: "Bonjour Cynthia — Bienvenue dans la bêta Inboria 🎁",
  html,
});

console.log(`[beta-welcome] sent to ${EMAIL}`);
