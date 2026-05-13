// SEED RGPD-compliant pour entrainement Inboria.
// Cree ~20 projets B2B chez Richard Martin (jj.neybergh@xchangesuite.com)
// + ~200 mails fictifs distribues entre ces projets,
// + ~10 mails marques is_private=true.
//
// CONFORMITE RGPD :
// - Domaines RFC 2606 reserves (.test, .example) → JAMAIS de vraie boite
// - Noms volontairement generiques (initiales) → pas d'homonyme reel
// - Pas de donnees sensibles inventees (IBAN, NAS, sante, religion, politique)
// - external_id prefixe "seed:richard:" → tracable et purgeable d'1 commande
// - Marquage seedTag dans le body (commentaire HTML) → identifiable
//
// USAGE :
//   pnpm exec tsx scripts/seed-richard.ts
//
// PURGE :
//   pnpm exec tsx scripts/purge-richard-seed.ts

import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SECRET_KEY!;
const supa = createClient(URL, SERVICE);

const RICHARD_ID = "1d04a551-2164-412b-bed0-1b772982b62d";
const SHARED_MAILBOX_ID = "6c04623f-51f7-412b-9822-b63f4bcf7a4d";
const ORG_ID = "b5782793-d028-4b4c-af8d-1b95bffef418";
const SEED_TAG = "<!-- inboria-seed-richard v1 -->";

interface ProjectSeed {
  ref: string;
  name: string;
  description: string;
  color: string;
  contactName: string;
  contactEmail: string;
  topic: string; // theme for body generation
}

const PROJECTS: ProjectSeed[] = [
  { ref: "RM-001", name: "Refonte site corporate Acme", description: "Refonte complete du site web corporate Acme Industries (10 pages, multi-langue FR/EN/NL).", color: "blue", contactName: "Sophie L.", contactEmail: "sophie.l@acme.test", topic: "site web" },
  { ref: "RM-002", name: "Recrutement Lead Developer Northwind", description: "Mission recrutement d'un Lead Developer senior pour le compte de Northwind Trading.", color: "purple", contactName: "Marc D.", contactEmail: "marc.d@northwind.test", topic: "recrutement" },
  { ref: "RM-003", name: "Migration ERP Globex", description: "Pilotage migration ERP SAP -> Odoo pour Globex Corporation (300 utilisateurs).", color: "red", contactName: "Claire B.", contactEmail: "claire.b@globex.test", topic: "ERP" },
  { ref: "RM-004", name: "Salon InnoTech 2026", description: "Organisation stand entreprise au salon InnoTech 2026 a Paris (3 jours, 50m2).", color: "orange", contactName: "Julien R.", contactEmail: "julien.r@innotech.example", topic: "salon" },
  { ref: "RM-005", name: "Audit RGPD Initech", description: "Audit conformite RGPD pour Initech Solutions (registre, DPIA, contrats sous-traitants).", color: "green", contactName: "Anne T.", contactEmail: "anne.t@initech.test", topic: "RGPD" },
  { ref: "RM-006", name: "Renouvellement contrat Soylent", description: "Negociation renouvellement contrat de maintenance triennal Soylent Group.", color: "yellow", contactName: "Pierre M.", contactEmail: "pierre.m@soylent.test", topic: "contrat" },
  { ref: "RM-007", name: "Refonte logo Umbrella", description: "Refonte identite visuelle (logo + charte) pour Umbrella Pharma. Livraison 30 juin.", color: "pink", contactName: "Laure F.", contactEmail: "laure.f@umbrella.test", topic: "branding" },
  { ref: "RM-008", name: "Deploiement CRM Stark", description: "Deploiement HubSpot CRM pour Stark Engineering (5 sites, 80 commerciaux).", color: "blue", contactName: "Tony S.", contactEmail: "tony.s@stark.test", topic: "CRM" },
  { ref: "RM-009", name: "Formation equipe Wayne", description: "Formation 2 jours equipe commerciale Wayne Enterprises (12 participants, methode SPIN).", color: "purple", contactName: "Bruce K.", contactEmail: "bruce.k@wayne.test", topic: "formation" },
  { ref: "RM-010", name: "Litige facture Tyrell", description: "Suivi litige facture impayee Tyrell Corp (12.450 EUR HT, depuis fevrier).", color: "red", contactName: "Eldon T.", contactEmail: "eldon.t@tyrell.test", topic: "litige" },
  { ref: "RM-011", name: "Appel d'offres ville Hill Valley", description: "Reponse appel d'offres mairie Hill Valley (modernisation messagerie 200 agents). Date limite 15 juillet.", color: "orange", contactName: "Marc M.", contactEmail: "marc.m@hillvalley.example", topic: "AO public" },
  { ref: "RM-012", name: "Migration Office365 Dunder", description: "Migration Exchange on-prem -> Office 365 pour Dunder Mifflin (50 boites mail).", color: "green", contactName: "Pam B.", contactEmail: "pam.b@dunder.test", topic: "Office365" },
  { ref: "RM-013", name: "Audit securite Cyberdyne", description: "Audit securite SI + pentest pour Cyberdyne Systems. Rapport attendu fin juin.", color: "red", contactName: "Sarah C.", contactEmail: "sarah.c@cyberdyne.test", topic: "securite" },
  { ref: "RM-014", name: "Refonte intranet Pied Piper", description: "Refonte intranet collaboratif Pied Piper sur SharePoint. Phase 1 : cadrage.", color: "yellow", contactName: "Richard H.", contactEmail: "richard.h@piedpiper.test", topic: "intranet" },
  { ref: "RM-015", name: "Maintenance annuelle Hooli", description: "Contrat maintenance annuelle infrastructure Hooli (24/7, SLA 4h). Reconduction tacite.", color: "pink", contactName: "Gavin B.", contactEmail: "gavin.b@hooli.test", topic: "maintenance" },
  { ref: "RM-016", name: "Lancement produit Vandelay", description: "Accompagnement lancement nouveau produit Vandelay Industries (campagne marketing + tournee 5 villes).", color: "blue", contactName: "Art V.", contactEmail: "art.v@vandelay.test", topic: "lancement" },
  { ref: "RM-017", name: "Conformite ISO27001 Massive Dynamic", description: "Mise en conformite ISO 27001 pour Massive Dynamic. Audit blanc octobre.", color: "purple", contactName: "Walter B.", contactEmail: "walter.b@massive.test", topic: "ISO" },
  { ref: "RM-018", name: "Workshop UX Paper Street", description: "Workshop UX 1 jour pour equipe produit Paper Street (8 participants, methode design sprint).", color: "green", contactName: "Tyler D.", contactEmail: "tyler.d@paperstreet.test", topic: "UX" },
  { ref: "RM-019", name: "Integration API Aperture", description: "Integration API REST Aperture Science -> notre plateforme (auth OAuth2, 6 endpoints).", color: "orange", contactName: "Cave J.", contactEmail: "cave.j@aperture.test", topic: "API" },
  { ref: "RM-020", name: "Gala anniversaire Oscorp", description: "Organisation gala 25 ans Oscorp (300 invites, traiteur, animation, retransmission live).", color: "yellow", contactName: "Norman O.", contactEmail: "norman.o@oscorp.test", topic: "evenement" },
];

// Templates de mails par type. Inbound = du client, outbound = de Richard.
type MailTemplate = {
  direction: "in" | "out";
  daysAgo: number;
  subjectPrefix: string;
  body: (p: ProjectSeed) => string;
  status?: string;
  priority?: string;
};

function eur(n: number) { return `${n.toLocaleString("fr-FR")} EUR HT`; }

const MAIL_TEMPLATES: MailTemplate[] = [
  { direction: "in", daysAgo: 65, subjectPrefix: "Demande de devis", priority: "moyen", body: (p) => `Bonjour Richard,\n\nNous souhaitons obtenir un devis pour le projet ${p.name.toLowerCase()}.\nPouvez-vous nous proposer un chiffrage et un planning indicatif ?\n\nMerci par avance,\n${p.contactName}\n${p.contactEmail}` },
  { direction: "out", daysAgo: 64, subjectPrefix: "Re: Demande de devis", body: (p) => `Bonjour ${p.contactName.split(" ")[0]},\n\nMerci pour votre demande. Je vous transmets notre proposition pour le ${p.topic} sous 48h ouvrees, avec planning detaille et estimation budgetaire.\n\nCordialement,\nRichard Martin` },
  { direction: "out", daysAgo: 62, subjectPrefix: "Devis – " , body: (p) => `Bonjour ${p.contactName.split(" ")[0]},\n\nVeuillez trouver ci-joint notre proposition pour le projet "${p.name}".\nMontant total : ${eur(8000 + Math.floor(Math.random() * 30000))}.\nDelai : 6 a 10 semaines apres validation.\n\nJe reste a votre disposition pour en discuter.\n\nRichard Martin` },
  { direction: "in", daysAgo: 60, subjectPrefix: "Re: Devis – ", priority: "moyen", body: (p) => `Bonjour Richard,\n\nMerci pour votre proposition. Quelques questions :\n- le delai peut-il etre raccourci ?\n- le budget est-il negociable sur la phase 2 ?\n\nNous attendons votre retour pour valider.\n\n${p.contactName}` },
  { direction: "out", daysAgo: 59, subjectPrefix: "Re: Devis – ", body: (p) => `Bonjour ${p.contactName.split(" ")[0]},\n\nNous pouvons reduire le delai de 1 semaine en mobilisant un consultant supplementaire (+ ${eur(1500)}).\nSur la phase 2, une remise commerciale de 5% est envisageable a la signature.\n\nProposition revisee jointe.\n\nCordialement,\nRichard Martin` },
  { direction: "in", daysAgo: 55, subjectPrefix: "Validation devis – ", priority: "urgent", body: (p) => `Bonjour Richard,\n\nNous validons votre proposition pour ${p.name.toLowerCase()}. Pouvez-vous nous transmettre :\n- le bon de commande,\n- la date de demarrage proposee,\n- la liste des contacts cle de votre cote.\n\nMerci,\n${p.contactName}` },
  { direction: "out", daysAgo: 54, subjectPrefix: "BDC + planning – ", body: (p) => `Bonjour ${p.contactName.split(" ")[0]},\n\nExcellente nouvelle ! Je vous joins le bon de commande contresigne et le planning detaille. Demarrage propose la semaine du 1er juin.\n\nKick-off prevu en visio (1h). Plusieurs creneaux possibles, je reviens vers vous dans la journee.\n\nRichard Martin` },
  { direction: "in", daysAgo: 45, subjectPrefix: "RDV kick-off – ", priority: "moyen", body: (p) => `Bonjour Richard,\n\nDisponibles pour le kick-off : mardi 9h, mercredi 14h ou jeudi 10h.\nMerci de confirmer le creneau le plus rapidement possible.\n\n${p.contactName}` },
  { direction: "out", daysAgo: 30, subjectPrefix: "Compte-rendu reunion – ", body: (p) => `Bonjour ${p.contactName.split(" ")[0]},\n\nMerci pour cette reunion productive. Vous trouverez ci-joint le compte-rendu et la liste des actions :\n- ACTION 1 : transmission specs detaillees (vous, J+5)\n- ACTION 2 : maquettes V1 (nous, J+10)\n- ACTION 3 : revue intermediaire (vous + nous, J+15)\n\nProchaine reunion fixee dans 2 semaines.\n\nRichard Martin` },
  { direction: "in", daysAgo: 12, subjectPrefix: "Question rapide – ", priority: "moyen", body: (p) => `Bonjour Richard,\n\nPetite question sur le ${p.topic} : pouvez-vous nous confirmer que la livraison est toujours prevue fin juin ?\nNous avons un comite de pilotage interne le 5 juillet et besoin d'un statut clair.\n\nMerci,\n${p.contactName}` },
];

function buildExternalId(projectIdx: number, mailIdx: number): string {
  return `seed:richard:rm-${String(projectIdx + 1).padStart(3, "0")}:mail-${String(mailIdx).padStart(2, "0")}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  // randomize hour/minute for realism
  d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

async function ensureProject(p: ProjectSeed): Promise<string> {
  const { data: existing } = await supa
    .from("projects")
    .select("id")
    .eq("user_id", RICHARD_ID)
    .eq("reference", p.ref)
    .maybeSingle();
  if (existing?.id) {
    console.log(`  · projet ${p.ref} deja present (${existing.id})`);
    return existing.id as string;
  }
  const { data, error } = await supa
    .from("projects")
    .insert({
      user_id: RICHARD_ID,
      reference: p.ref,
      name: p.name,
      description: p.description,
      color: p.color,
      status: "actif",
    })
    .select("id")
    .single();
  if (error) throw new Error(`projet ${p.ref}: ${error.message}`);
  console.log(`  + projet ${p.ref} cree (${data.id})`);
  return data.id as string;
}

interface SeedRow {
  user_id: string;
  external_id: string;
  sender: string;
  recipient: string | null;
  subject: string;
  body: string;
  status: string;
  priority: string;
  project_id: string;
  shared_mailbox_id: string;
  assigned_to: string;
  created_at: string;
  is_private: boolean;
}

async function seedMailsForProject(p: ProjectSeed, projIdx: number, projectId: string): Promise<number> {
  const rows: SeedRow[] = [];
  let mailIdx = 0;
  for (const tpl of MAIL_TEMPLATES) {
    mailIdx++;
    const externalId = buildExternalId(projIdx, mailIdx);
    const isOutgoing = tpl.direction === "out";
    const sender = isOutgoing ? `Richard Martin <jj.neybergh@xchangesuite.com>` : `${p.contactName} <${p.contactEmail}>`;
    const recipient = isOutgoing ? `${p.contactName} <${p.contactEmail}>` : `Richard Martin <jj.neybergh@xchangesuite.com>`;
    const status = isOutgoing ? "sent" : (mailIdx <= 6 ? "lu" : "non_lu");
    const subject = `${tpl.subjectPrefix}${tpl.subjectPrefix.endsWith(" ") || tpl.subjectPrefix.endsWith(" – ") ? p.name : ""}`.trim();
    const body = `${tpl.body(p)}\n\n${SEED_TAG}`;
    rows.push({
      user_id: RICHARD_ID,
      external_id: externalId,
      sender,
      recipient,
      subject,
      body,
      status,
      priority: tpl.priority || "faible",
      project_id: projectId,
      shared_mailbox_id: SHARED_MAILBOX_ID,
      assigned_to: RICHARD_ID,
      created_at: isoDaysAgo(tpl.daysAgo),
      is_private: false,
    });
  }
  // idempotent : on supprime d'abord les anciennes lignes seed de ce projet
  const ids = rows.map((r) => r.external_id);
  await supa.from("emails").delete().in("external_id", ids);
  const { error } = await supa.from("emails").insert(rows);
  if (error) throw new Error(`mails ${p.ref}: ${error.message}`);
  return rows.length;
}

interface PrivateRow {
  user_id: string;
  external_id: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  priority: string;
  shared_mailbox_id: string;
  assigned_to: string;
  is_private: boolean;
  created_at: string;
}

async function seedPrivateMails(): Promise<number> {
  // 10 mails marques is_private=true cote Richard. Sujets neutres,
  // pas de donnees sensibles sante/origine/religion/politique inventees.
  const privates: { subject: string; body: string; daysAgo: number }[] = [
    { subject: "Demande de conges juillet", body: "Bonjour,\n\nJe pose mes conges du 14 au 28 juillet.\nMerci de valider.\n\nRichard", daysAgo: 50 },
    { subject: "RDV personnel mardi matin", body: "Note perso : RDV mardi 14 mai 8h45. Decaler la reunion equipe a 10h.", daysAgo: 40 },
    { subject: "Mutuelle entreprise – option famille", body: "Question RH interne sur l'option famille de la mutuelle. Repondre en interne.", daysAgo: 35 },
    { subject: "Confidentiel – note interne", body: "Note interne strictement confidentielle. Ne pas faire suivre.", daysAgo: 30 },
    { subject: "RDV banque mercredi 15h", body: "Pense-bete personnel : RDV banque mercredi 15h. Apporter justificatifs.", daysAgo: 28 },
    { subject: "Reservation hotel Bruxelles", body: "Confirmation reservation hotel personnel pour le week-end.", daysAgo: 22 },
    { subject: "Demande de teletravail vendredi", body: "Demande de teletravail le vendredi 16 mai. Merci de valider.", daysAgo: 20 },
    { subject: "Notes personnelles – revue annuelle", body: "Notes preparatoires entretien annuel. Strictement personnel.", daysAgo: 15 },
    { subject: "Famille – anniversaire dimanche", body: "Pense-bete : appeler maman pour anniversaire dimanche.", daysAgo: 10 },
    { subject: "Prive – ne pas partager", body: "Element prive, non lie a un dossier client.", daysAgo: 5 },
  ];
  const rows: PrivateRow[] = privates.map((m, i) => ({
    user_id: RICHARD_ID,
    external_id: `seed:richard:private:${String(i + 1).padStart(2, "0")}`,
    sender: `Richard Martin <jj.neybergh@xchangesuite.com>`,
    recipient: `Richard Martin <jj.neybergh@xchangesuite.com>`,
    subject: m.subject,
    body: `${m.body}\n\n${SEED_TAG}`,
    status: "lu",
    priority: "faible",
    shared_mailbox_id: SHARED_MAILBOX_ID,
    assigned_to: RICHARD_ID,
    is_private: true,
    created_at: isoDaysAgo(m.daysAgo),
  }));
  const ids = rows.map((r) => r.external_id);
  await supa.from("emails").delete().in("external_id", ids);
  const { error } = await supa.from("emails").insert(rows);
  if (error) throw new Error(`private mails: ${error.message}`);
  return rows.length;
}

async function main() {
  console.log("=== SEED RICHARD MARTIN (RGPD-safe) ===\n");
  console.log(`Owner: Richard Martin (${RICHARD_ID})`);
  console.log(`Shared mailbox: ${SHARED_MAILBOX_ID}`);
  console.log(`Org: ${ORG_ID}\n`);

  console.log("→ Projets...");
  const projectIds: { p: ProjectSeed; id: string }[] = [];
  for (const p of PROJECTS) {
    const id = await ensureProject(p);
    projectIds.push({ p, id });
  }

  console.log(`\n→ Mails de projet (${PROJECTS.length} projets x ${MAIL_TEMPLATES.length} mails)...`);
  let totalMails = 0;
  for (let i = 0; i < projectIds.length; i++) {
    const { p, id } = projectIds[i]!;
    const n = await seedMailsForProject(p, i, id);
    totalMails += n;
    console.log(`  + ${p.ref}: ${n} mails`);
  }

  console.log("\n→ Mails prives (Richard, is_private=true)...");
  const nPriv = await seedPrivateMails();
  console.log(`  + ${nPriv} mails prives crees`);

  console.log("\n=== TOTAUX ===");
  console.log(`  Projets : ${projectIds.length}`);
  console.log(`  Mails de projet : ${totalMails}`);
  console.log(`  Mails prives : ${nPriv}`);
  console.log(`  TOTAL mails : ${totalMails + nPriv}`);
  console.log("\nPurge : pnpm exec tsx scripts/purge-richard-seed.ts");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
