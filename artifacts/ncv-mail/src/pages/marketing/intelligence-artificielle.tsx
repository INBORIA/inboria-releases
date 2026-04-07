import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import {
  Brain,
  ArrowRight,
  CheckCircle2,
  Tags,
  FileText,
  PenLine,
  BarChart3,
  AlertTriangle,
  FolderKanban,
  Sparkles,
  ShieldCheck,
  Eye,
  Lock,
  Zap,
  Server,
} from "lucide-react";

const heroStats = [
  { value: "IA avancée", label: "dernière génération" },
  { value: "<3s", label: "temps de traitement" },
  { value: "RGPD", label: "conforme et sécurisé" },
];

const aiFeatures = [
  {
    icon: Tags,
    title: "Tri automatique par catégories",
    desc: "Chaque email entrant est analysé par l'IA qui identifie son sujet, son expéditeur et son contexte pour le classer automatiquement dans la bonne catégorie. Finis les emails non triés qui s'accumulent.",
    highlights: [
      "Analyse sémantique du contenu",
      "Reconnaissance des expéditeurs récurrents",
      "Classement en temps réel à la réception",
      "Apprentissage de vos préférences",
    ],
  },
  {
    icon: FileText,
    title: "Résumés intelligents",
    desc: "Les longs fils de discussion, les newsletters interminables et les échanges complexes sont résumés en quelques lignes claires. Vous comprenez l'essentiel sans tout lire.",
    highlights: [
      "Résumé en une phrase ou un paragraphe",
      "Extraction des points clés",
      "Identification des actions demandées",
      "Synthèse des fils de 10+ emails",
    ],
  },
  {
    icon: PenLine,
    title: "Brouillons de réponse IA",
    desc: "NCV Mail prépare des réponses pertinentes et contextuelles que vous n'avez qu'à relire et valider. L'IA s'adapte à votre ton et à votre style d'écriture.",
    highlights: [
      "Réponses adaptées au contexte",
      "Ton professionnel personnalisé",
      "Suggestions de formulations",
      "Un clic pour envoyer",
    ],
  },
  {
    icon: BarChart3,
    title: "Brief quotidien",
    desc: "Chaque matin, recevez un récapitulatif intelligent : emails urgents, réunions du jour, suivis en attente et tâches extraites. Commencez votre journée avec une vue claire.",
    highlights: [
      "Récap matinal automatique",
      "Priorités mises en évidence",
      "Réunions et deadlines du jour",
      "Suivi des emails sans réponse",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Détection de priorité",
    desc: "L'IA identifie automatiquement les emails urgents, les demandes de clients importants et les messages nécessitant une action rapide. Ils sont mis en évidence dans votre boîte.",
    highlights: [
      "Emails urgents signalés",
      "VIP et clients importants détectés",
      "Deadlines extraites automatiquement",
      "Notifications de priorité haute",
    ],
  },
  {
    icon: FolderKanban,
    title: "Packs métiers générés par IA",
    desc: "Votre métier n'est pas dans nos 56 packs pré-configurés ? Décrivez simplement votre activité et l'IA génère un pack de catégories sur mesure, parfaitement adapté à vos besoins.",
    highlights: [
      "Génération en langage naturel",
      "Entre 6 et 12 catégories pertinentes",
      "Noms et descriptions générés",
      "Application en un clic",
    ],
  },
];

const principles = [
  {
    icon: Eye,
    title: "Transparence totale",
    desc: "Chaque action de l'IA est visible et explicable. Vous voyez pourquoi un email a été classé dans telle catégorie et pouvez toujours corriger.",
  },
  {
    icon: Lock,
    title: "Vos données restent les vôtres",
    desc: "Aucun email n'est utilisé pour entraîner des modèles. Vos données sont traitées en temps réel et ne sont jamais stockées par les fournisseurs d'IA.",
  },
  {
    icon: ShieldCheck,
    title: "Conforme RGPD",
    desc: "NCV Mail respecte strictement le Règlement Général sur la Protection des Données. Hébergement en Europe, chiffrement et droit à l'effacement garanti.",
  },
  {
    icon: Server,
    title: "Infrastructure sécurisée",
    desc: "Chiffrement en transit et au repos. Authentification renforcée. Aucune donnée sensible n'est jamais exposée dans les logs ou les réponses IA.",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Email reçu",
    desc: "Un email arrive dans votre boîte de réception NCV Mail.",
  },
  {
    step: "2",
    title: "Analyse IA",
    desc: "L'IA analyse le contenu, l'expéditeur, le sujet et le contexte en moins de 3 secondes.",
  },
  {
    step: "3",
    title: "Actions automatiques",
    desc: "L'email est classé, résumé, et un brouillon de réponse est préparé si nécessaire.",
  },
  {
    step: "4",
    title: "Vous validez",
    desc: "Vous retrouvez tout organisé. Un clic pour valider les suggestions de l'IA.",
  },
];

export default function IntelligenceArtificielle() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 via-[#2d7dd2]/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 mb-6">
            <Brain className="w-3.5 h-3.5 text-[#2d7dd2]" />
            <span className="text-[12px] font-medium text-[#2d7dd2]">Intelligence Artificielle</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            L'IA qui gère vos emails<br className="hidden sm:block" /> pendant que vous travaillez
          </h1>
          <p className="mt-5 text-[15px] sm:text-[16px] text-[#8b9cb3] max-w-2xl mx-auto leading-relaxed">
            NCV Mail intègre une intelligence artificielle avancée qui trie, résume,
            catégorise et prépare vos réponses automatiquement. Vous gardez le contrôle,
            l'IA fait le travail répétitif.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors flex items-center gap-2">
                Essayer l'IA gratuitement
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/fonctionnalites">
              <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white hover:border-[#2d7dd2]/30 transition-colors">
                Toutes les fonctionnalités
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
              Ce que fait l'IA pour vous
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              Six fonctionnalités d'IA intégrées qui transforment votre gestion des emails au quotidien.
            </p>
          </div>

          <div className="space-y-6">
            {aiFeatures.map((feat) => (
              <div
                key={feat.title}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 sm:p-8 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                        <feat.icon className="w-5 h-5 text-[#2d7dd2]" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-white">{feat.title}</h3>
                    </div>
                    <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{feat.desc}</p>
                  </div>
                  <div className="lg:w-64 shrink-0">
                    <ul className="space-y-2">
                      {feat.highlights.map((h) => (
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

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Comment fonctionne l'IA ?
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3]">
              Du mail reçu à l'action validée, en 4 étapes transparentes.
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

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Sécurité et confidentialité de l'IA
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              Nous prenons la protection de vos données aussi sérieusement que la performance de notre IA.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {principles.map((p) => (
              <div
                key={p.title}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                    <p.icon className="w-5 h-5 text-[#2d7dd2]" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-white">{p.title}</h3>
                </div>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Questions fréquentes sur l'IA
            </h2>
          </div>
          <div className="space-y-4">
            {[
              {
                q: "L'IA lit-elle vraiment tous mes emails ?",
                a: "L'IA analyse le contenu de vos emails uniquement pour les trier et les résumer. Aucun email n'est stocké par le fournisseur d'IA ni utilisé pour entraîner des modèles. Le traitement est éphémère et en temps réel.",
              },
              {
                q: "Puis-je désactiver l'IA ?",
                a: "Oui, chaque fonctionnalité IA (tri, résumés, brouillons) peut être désactivée individuellement depuis vos paramètres. Vous gardez toujours le contrôle total.",
              },
              {
                q: "L'IA fonctionne-t-elle en français ?",
                a: "Absolument. NCV Mail est conçu pour les PME francophones en Belgique et en France. L'IA comprend et répond en français, néerlandais et anglais.",
              },
              {
                q: "L'IA se trompe-t-elle parfois ?",
                a: "Comme toute IA, des erreurs sont possibles. C'est pourquoi chaque suggestion est présentée pour validation. Vous pouvez corriger un classement en un clic et l'IA apprend de vos corrections.",
              },
              {
                q: "Quel modèle d'IA est utilisé ?",
                a: "NCV Mail utilise des modèles de langage de dernière génération, reconnus pour leur fiabilité et leur performance en traitement du langage naturel. Nous sélectionnons et optimisons en permanence les meilleurs modèles disponibles pour garantir des résultats de qualité.",
              },
            ].map((faq) => (
              <div
                key={faq.q}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-5"
              >
                <h3 className="text-[14px] font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="rounded-2xl border border-[#2d7dd2]/20 bg-gradient-to-br from-[#141c2b] to-[#0d1117] p-8 sm:p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#2d7dd2]/10 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-7 h-7 text-[#2d7dd2]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              Laissez l'IA travailler pour vous
            </h2>
            <p className="mt-4 text-[14px] text-[#8b9cb3] max-w-lg mx-auto">
              Rejoignez les PME qui gagnent 2 heures par jour grâce à
              l'intelligence artificielle de NCV Mail.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                  Essayer gratuitement
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white transition-colors">
                  Voir les tarifs
                </button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[#8b9cb3]/60">
              100 emails offerts • Aucune carte bancaire requise • IA incluse dans tous les plans
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
