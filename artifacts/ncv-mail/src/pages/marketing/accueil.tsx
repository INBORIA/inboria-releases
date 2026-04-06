import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { AnimatedDemo } from "@/components/marketing/animated-demo";
import { Mail, Tags, Zap, Clock, Eye, Shield } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Mail,
    title: "Connectez votre boite mail",
    desc: "Integration simple et securisee avec votre messagerie existante en quelques clics.",
  },
  {
    num: "02",
    icon: Tags,
    title: "Creez vos rubriques personnalisees",
    desc: "Definissez vos propres categories selon votre metier et vos besoins specifiques.",
  },
  {
    num: "03",
    icon: Zap,
    title: "L'IA gere votre inbox en autopilot",
    desc: "Notre intelligence artificielle trie, priorise, prepare des reponses et extrait vos taches automatiquement. Votre inbox est deja geree quand vous arrivez le matin.",
  },
];

const benefits = [
  {
    icon: Clock,
    title: "Gain de temps",
    desc: "Economisez plusieurs heures par semaine en automatisant le tri de vos emails.",
  },
  {
    icon: Tags,
    title: "Personnalisation totale",
    desc: "Creez des regles de tri adaptees a votre activite et vos priorites.",
  },
  {
    icon: Shield,
    title: "Securite des donnees",
    desc: "Vos donnees restent confidentielles et securisees avec un chiffrement de bout en bout.",
  },
  {
    icon: Eye,
    title: "Vision claire",
    desc: "Retrouvez instantanement vos emails importants grace a une organisation optimale.",
  },
];

export default function Accueil() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 text-center relative">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
            <span className="text-white">Votre inbox est deja geree</span><br />
            <span className="text-white">quand vous arrivez le matin.</span><br />
            <span className="text-[#2d7dd2]">NCV Mail — l'Email Autopilot.</span>
          </h1>
          <p className="mt-6 text-[16px] sm:text-[18px] text-[#8b9cb3] max-w-2xl mx-auto leading-relaxed">
            NCV Mail lit, analyse et classe automatiquement vos emails selon VOS propres regles.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <button className="px-6 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                Commencer gratuitement
              </button>
            </Link>
          </div>

          <AnimatedDemo />
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Comment ca marche</h2>
            <p className="text-[14px] text-[#8b9cb3] mt-2">
              Trois etapes simples pour transformer votre gestion d'emails
            </p>
          </div>
          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.num} className="flex items-start gap-6">
                <span className="text-4xl sm:text-5xl font-extrabold text-[#2d7dd2]/20 shrink-0 leading-none">{step.num}</span>
                <div className="flex items-start gap-4 pt-1">
                  <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                    <step.icon className="w-5 h-5 text-[#2d7dd2]" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-white">{step.title}</h3>
                    <p className="text-[14px] text-[#8b9cb3] mt-1 max-w-lg">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <p className="text-[14px] text-[#8b9cb3]">
              Decouvrez pourquoi des milliers de professionnels nous font confiance
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center mb-4">
                  <b.icon className="w-5 h-5 text-[#2d7dd2]" />
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">{b.title}</h3>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{b.desc}</p>
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
