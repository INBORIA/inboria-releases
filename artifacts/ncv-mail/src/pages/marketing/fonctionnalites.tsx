import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import {
  Tags,
  FileText,
  PenLine,
  BarChart3,
  CheckSquare,
  FolderKanban,
  Inbox,
  Signature,
  Archive,
  AlertTriangle,
  Smartphone,
  Shield,
} from "lucide-react";

const features = [
  {
    icon: Tags,
    title: "Tri intelligent par categories",
    desc: "L'intelligence artificielle analyse le contenu de vos emails et les classe automatiquement dans les dossiers appropries pour garder une boite de reception propre.",
  },
  {
    icon: FileText,
    title: "Resumes automatiques",
    desc: "Gagnez un temps precieux en lisant un resume concis genere par l'IA pour les longs fils de discussion et les newsletters interminables.",
  },
  {
    icon: PenLine,
    title: "Brouillons IA personnalises",
    desc: "NCV Mail prepare des reponses adaptees au contexte et a votre ton habituel. Il ne vous reste plus qu'a relire et envoyer.",
  },
  {
    icon: BarChart3,
    title: "Brief quotidien",
    desc: "Recevez chaque matin un recapitulatif clair des emails urgents, des reunions du jour et des suivis en attente.",
  },
  {
    icon: CheckSquare,
    title: "Extraction automatique des taches",
    desc: "Les actions a realiser mentionnees dans vos echanges sont automatiquement detectees et ajoutees a votre gestionnaire de taches.",
  },
  {
    icon: FolderKanban,
    title: "Gestion de projets",
    desc: "Regroupez intelligemment tous les echanges, pieces jointes et intervenants lies a un meme projet dans un espace dedie.",
  },
  {
    icon: Inbox,
    title: "Connexion multi-boites",
    desc: "Centralisez tous vos comptes (Gmail, Outlook, iCloud, IMAP) dans une interface unique et unifiee sans friction.",
  },
  {
    icon: Signature,
    title: "Signature email personnalisee",
    desc: "Creez, gerez et deployez des signatures professionnelles dynamiques et harmonisees pour vous ou toute votre equipe.",
  },
  {
    icon: Archive,
    title: "Archivage intelligent",
    desc: "Nettoyage proactif de votre boite : les newsletters lues et les notifications obsoletes sont archivees ou supprimees selon vos regles.",
  },
  {
    icon: AlertTriangle,
    title: "Detection de priorite",
    desc: "Ne manquez plus l'essentiel. Les emails de vos clients importants ou contenant des urgences sont mis en evidence instantanement.",
  },
  {
    icon: Smartphone,
    title: "Application mobile",
    desc: "Restez productif en deplacement avec notre application iOS et Android optimisee pour une consultation rapide et efficace.",
  },
  {
    icon: Shield,
    title: "Securite et confidentialite",
    desc: "Vos donnees sont protegees par un chiffrement de bout en bout. Nous respectons strictement le RGPD et ne vendons jamais vos informations.",
  },
];

export default function Fonctionnalites() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Tout ce dont vous avez besoin pour reprendre le controle de vos emails
          </h1>
          <p className="mt-4 text-[16px] text-[#8b9cb3] max-w-2xl mx-auto">
            NCV Mail utilise l'intelligence artificielle pour trier, resumer et repondre a vos emails automatiquement.
          </p>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-[#2d7dd2]" />
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Pret a gagner 2h par jour ?</h2>
          <p className="text-[14px] text-[#8b9cb3] mt-3">
            100 emails offerts pour decouvrir NCV Mail. Aucune carte bancaire requise.
          </p>
          <Link href="/signup">
            <button className="mt-6 px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
              Essayer gratuitement
            </button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
