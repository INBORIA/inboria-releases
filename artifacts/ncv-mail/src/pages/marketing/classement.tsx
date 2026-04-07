import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import {
  FolderKanban,
  ArrowRight,
  CheckCircle2,
  Package,
  Briefcase,
  Heart,
  ShoppingCart,
  Building,
  Calculator,
  Wrench,
  GraduationCap,
  UtensilsCrossed,
  Sparkles,
  Search,
  Layers,
  Zap,
  ShieldCheck,
} from "lucide-react";

const heroStats = [
  { value: "56+", label: "packs metiers disponibles" },
  { value: "9", label: "familles de secteurs" },
  { value: "IA", label: "generation personnalisee" },
];

const familles = [
  {
    icon: Briefcase,
    name: "Services professionnels",
    desc: "Avocats, comptables, notaires, consultants, architectes, courtiers... Des categories adaptees aux echanges juridiques, financiers et de conseil.",
    packs: ["Avocat", "Comptable", "Notaire", "Consultant", "Architecte", "Courtier en assurances"],
  },
  {
    icon: Heart,
    name: "Sante",
    desc: "Medecins, dentistes, kinesitherapeutes, pharmaciens, veterinaires, psychologues. Gestion des rendez-vous, ordonnances, laboratoires et mutuelles.",
    packs: ["Medecin generaliste", "Dentiste", "Kinesitherapeute", "Pharmacien", "Veterinaire", "Psychologue"],
  },
  {
    icon: ShoppingCart,
    name: "Commerce & Distribution",
    desc: "Boutiques, e-commerce, grossistes, fleuristes, cavistes. Commandes, fournisseurs, logistique et relation client au quotidien.",
    packs: ["Boutique / Commerce de detail", "E-commerce", "Grossiste", "Fleuriste", "Caviste"],
  },
  {
    icon: Building,
    name: "Immobilier & Construction",
    desc: "Agences immobilieres, syndics, entreprises de construction, promoteurs. Mandats, visites, chantiers, devis et appels d'offres.",
    packs: ["Agence immobiliere", "Syndic de copropriete", "Entreprise de construction", "Promoteur immobilier"],
  },
  {
    icon: Calculator,
    name: "Services aux entreprises",
    desc: "Agences marketing, cabinets RH, bureaux d'etudes, societes IT, experts-comptables. Projets, reporting, facturation et collaboration client.",
    packs: ["Agence de communication", "Cabinet RH", "Bureau d'etudes", "Societe IT", "Expert-comptable"],
  },
  {
    icon: Wrench,
    name: "Artisanat & Metiers techniques",
    desc: "Electriciens, plombiers, menuisiers, garagistes, paysagistes. Devis, interventions, SAV et gestion des sous-traitants.",
    packs: ["Electricien", "Plombier", "Menuisier", "Garagiste", "Paysagiste"],
  },
  {
    icon: GraduationCap,
    name: "Enseignement & Formation",
    desc: "Ecoles privees, centres de formation, coachs, auto-ecoles. Inscriptions, plannings, certifications et communication parents/eleves.",
    packs: ["Ecole privee", "Centre de formation", "Coach / Formateur independant", "Auto-ecole"],
  },
  {
    icon: UtensilsCrossed,
    name: "Restauration & Tourisme",
    desc: "Restaurants, hotels, traiteurs, agences de voyage, gites. Reservations, fournisseurs, evenements et avis clients.",
    packs: ["Restaurant", "Hotel / B&B", "Traiteur", "Agence de voyage"],
  },
  {
    icon: Sparkles,
    name: "Autres services",
    desc: "Associations, createurs de contenu, mode, transport, nettoyage, salons de beaute... Tous les metiers qui ne rentrent pas dans une seule case.",
    packs: ["Association / ONG", "Createur de contenu", "Mode / Textile", "Transport / Logistique", "Nettoyage / Entretien", "Salon de coiffure / Beaute"],
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Choisissez votre metier",
    desc: "Parcourez les 9 familles de secteurs et trouvez le pack qui correspond a votre activite.",
  },
  {
    step: "2",
    title: "Appliquez le pack",
    desc: "En un clic, les categories du pack sont ajoutees a votre compte sans ecraser vos categories existantes.",
  },
  {
    step: "3",
    title: "L'IA prend le relais",
    desc: "NCV Mail utilise vos categories pour trier automatiquement chaque email entrant dans le bon dossier.",
  },
  {
    step: "4",
    title: "Affinez au fil du temps",
    desc: "Ajoutez, modifiez ou supprimez des categories. Generez un pack IA personnalise si votre metier est unique.",
  },
];

const advantages = [
  {
    icon: Zap,
    title: "Operationnel en 30 secondes",
    desc: "Pas besoin de creer vos categories une par une. Un pack metier pre-configure vous fait gagner des heures de parametrage.",
    highlights: [
      "56 packs pour les metiers les plus courants",
      "Categories optimisees par secteur d'activite",
      "Application en un seul clic",
    ],
  },
  {
    icon: Sparkles,
    title: "IA sur mesure",
    desc: "Votre metier n'est pas dans la liste ? Decrivez votre activite et l'IA genere un pack de categories parfaitement adapte a vos besoins.",
    highlights: [
      "Generation intelligente par GPT",
      "Entre 6 et 12 categories sur mesure",
      "Nom et description pour chaque categorie",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Fusion sans ecrasement",
    desc: "Appliquer un pack n'efface jamais vos categories existantes. Les doublons sont detectes automatiquement et ignores.",
    highlights: [
      "Detection de doublons intelligente",
      "Vos categories personnelles preservees",
      "Tracabilite de l'origine (pack ou manuelle)",
    ],
  },
  {
    icon: Search,
    title: "Recherche et navigation intuitive",
    desc: "Trouvez instantanement le pack ideal grace a la recherche par mot-cle et aux familles de secteurs depliables.",
    highlights: [
      "Recherche en temps reel",
      "9 familles organisees par secteur",
      "Apercu du contenu avant application",
    ],
  },
];

export default function ClassementMarketing() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 via-[#2d7dd2]/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 mb-6">
            <FolderKanban className="w-3.5 h-3.5 text-[#2d7dd2]" />
            <span className="text-[12px] font-medium text-[#2d7dd2]">Classement intelligent</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            56 packs metiers pour organiser<br className="hidden sm:block" /> vos emails en un clic
          </h1>
          <p className="mt-5 text-[15px] sm:text-[16px] text-[#8b9cb3] max-w-2xl mx-auto leading-relaxed">
            NCV Mail propose des packs de categories pre-configures pour chaque profession.
            Avocat, medecin, restaurateur, e-commerce... Appliquez le votre
            et laissez l'IA trier vos emails automatiquement.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors flex items-center gap-2">
                Essayer gratuitement
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/tarifs">
              <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white hover:border-[#2d7dd2]/30 transition-colors">
                Voir les tarifs
              </button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {heroStats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-[11px] text-[#8b9cb3] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              9 familles de secteurs, 56 packs metiers
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              Chaque pack contient entre 6 et 12 categories optimisees pour votre activite.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {familles.map((f) => (
              <div
                key={f.name}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-[#2d7dd2]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">{f.name}</h3>
                    <p className="text-[11px] text-[#8b9cb3]">{f.packs.length} packs</p>
                  </div>
                </div>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed mb-4">{f.desc}</p>
                <div className="flex flex-wrap gap-2">
                  {f.packs.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#1f2937] text-[11px] text-[#8b9cb3]"
                    >
                      <Package className="w-3 h-3 text-[#2d7dd2]" />
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Les avantages du classement NCV Mail
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              Un systeme concu pour que chaque email arrive au bon endroit, sans effort.
            </p>
          </div>

          <div className="space-y-6">
            {advantages.map((adv) => (
              <div
                key={adv.title}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 sm:p-8 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                        <adv.icon className="w-5 h-5 text-[#2d7dd2]" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-white">{adv.title}</h3>
                    </div>
                    <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{adv.desc}</p>
                  </div>
                  <div className="lg:w-64 shrink-0">
                    <ul className="space-y-2">
                      {adv.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#2d7dd2] mt-0.5 shrink-0" />
                          <span className="text-[12px] text-[#8b9cb3]">{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Comment ca marche ?
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3]">
              Du choix du pack a l'automatisation complete, en 4 etapes simples.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((w) => (
              <div key={w.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[16px] font-bold text-[#2d7dd2]">{w.step}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-2">{w.title}</h3>
                <p className="text-[12px] text-[#8b9cb3] leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="rounded-2xl border border-[#2d7dd2]/20 bg-gradient-to-br from-[#141c2b] to-[#0d1117] p-8 sm:p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#2d7dd2]/10 flex items-center justify-center mx-auto mb-6">
              <Layers className="w-7 h-7 text-[#2d7dd2]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Votre boite mail organisee en 30 secondes
            </h2>
            <p className="mt-4 text-[14px] text-[#8b9cb3] max-w-lg mx-auto">
              Choisissez votre pack metier, appliquez-le, et laissez NCV Mail
              trier vos emails automatiquement. C'est aussi simple que ca.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                  Commencer gratuitement
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white transition-colors">
                  Voir les tarifs
                </button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[#8b9cb3]/60">
              100 emails offerts pour essayer • Aucune carte bancaire requise
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
