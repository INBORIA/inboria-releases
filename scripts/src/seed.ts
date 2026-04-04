import { db, usersTable, categoriesTable, emailsTable, tasksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomBytes, scryptSync } from "crypto";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  console.log("Seeding database...");

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.email, "demo@ncvmail.com"));
  if (existingUser) {
    console.log("Seed data already exists, skipping.");
    process.exit(0);
  }

  const [user] = await db.insert(usersTable).values({
    email: "demo@ncvmail.com",
    passwordHash: hashPassword("demo123"),
    fullName: "Marie Dupont",
    plan: "solo",
    seats: 1,
    emailsUsed: 47,
    emailsQuota: 3000,
  }).returning();

  const categoryData = [
    { userId: user.id, name: "Finance", description: "Factures, paiements, comptabilite" },
    { userId: user.id, name: "Clients", description: "Communications clients et prospects" },
    { userId: user.id, name: "RH", description: "Ressources humaines et recrutement" },
    { userId: user.id, name: "Marketing", description: "Campagnes et communications marketing" },
    { userId: user.id, name: "Administratif", description: "Documents et procedures administratives" },
  ];

  const categories = await db.insert(categoriesTable).values(categoryData).returning();

  const emailData = [
    {
      userId: user.id,
      categoryId: categories[0].id,
      sender: "Jean Martin",
      senderEmail: "jean.martin@comptable.be",
      subject: "Facture Q4 2025 - A valider urgemment",
      body: "Bonjour Marie, veuillez trouver ci-joint la facture du Q4. Merci de valider avant vendredi.",
      status: "classe",
      priority: "urgent",
      summary: "Facture Q4 a valider avant vendredi",
    },
    {
      userId: user.id,
      categoryId: categories[1].id,
      sender: "Sophie Leroy",
      senderEmail: "sophie@clientxyz.fr",
      subject: "Renouvellement contrat annuel",
      body: "Bonjour, nous souhaitons renouveler notre contrat. Pouvez-vous nous envoyer les nouvelles conditions?",
      status: "classe",
      priority: "urgent",
      summary: "Client demande renouvellement de contrat",
    },
    {
      userId: user.id,
      categoryId: categories[3].id,
      sender: "Newsletter Pro",
      senderEmail: "news@marketingpro.com",
      subject: "Tendances marketing digital 2026",
      body: "Decouvrez les dernieres tendances du marketing digital pour 2026...",
      status: "classe",
      priority: "faible",
      summary: "Newsletter marketing - tendances 2026",
    },
    {
      userId: user.id,
      categoryId: categories[2].id,
      sender: "Pierre Dubois",
      senderEmail: "pierre.dubois@candidat.fr",
      subject: "Candidature - Poste developpeur senior",
      body: "Madame, suite a votre offre d'emploi, je me permets de vous adresser ma candidature...",
      status: "classe",
      priority: "moyen",
      summary: "Candidature pour poste developpeur senior",
    },
    {
      userId: user.id,
      categoryId: categories[4].id,
      sender: "Administration fiscale",
      senderEmail: "noreply@impots.gouv.fr",
      subject: "Declaration TVA - Rappel echeance",
      body: "Rappel: votre declaration de TVA est attendue pour le 20 du mois en cours.",
      status: "classe",
      priority: "urgent",
      summary: "Rappel echeance declaration TVA",
    },
    {
      userId: user.id,
      categoryId: categories[1].id,
      sender: "Luc Bernard",
      senderEmail: "luc@partenairetech.be",
      subject: "Proposition de partenariat",
      body: "Bonjour Marie, nous aimerions discuter d'un potentiel partenariat technologique...",
      status: "classe",
      priority: "moyen",
      summary: "Proposition de partenariat technologique",
    },
  ];

  const emails = await db.insert(emailsTable).values(emailData).returning();

  await db.insert(tasksTable).values([
    {
      userId: user.id,
      emailId: emails[0].id,
      title: "Valider la facture Q4 2025",
      done: false,
      dueDate: "2026-04-10",
    },
    {
      userId: user.id,
      emailId: emails[1].id,
      title: "Envoyer conditions de renouvellement a Sophie Leroy",
      done: false,
      dueDate: "2026-04-08",
    },
    {
      userId: user.id,
      emailId: emails[4].id,
      title: "Preparer declaration TVA",
      done: false,
      dueDate: "2026-04-20",
    },
  ]);

  console.log("Seed complete! Demo account: demo@ncvmail.com / demo123");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
