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
import { useTranslation } from "react-i18next";
import { isPaymentsEnabled } from "@/lib/feature-flags";

const familleKeys = [
  { icon: Briefcase, key: "professionalServices", packs: ["Avocat", "Comptable", "Notaire", "Consultant", "Architecte", "Courtier en assurances"] },
  { icon: Heart, key: "health", packs: ["Médecin généraliste", "Dentiste", "Kinésithérapeute", "Pharmacien", "Vétérinaire", "Psychologue"] },
  { icon: ShoppingCart, key: "commerce", packs: ["Boutique / Commerce de détail", "E-commerce", "Grossiste", "Fleuriste", "Caviste"] },
  { icon: Building, key: "realEstate", packs: ["Agence immobilière", "Syndic de copropriété", "Entreprise de construction", "Promoteur immobilier"] },
  { icon: Calculator, key: "businessServices", packs: ["Agence de communication", "Cabinet RH", "Bureau d'études", "Société IT", "Expert-comptable"] },
  { icon: Wrench, key: "crafts", packs: ["Électricien", "Plombier", "Menuisier", "Garagiste", "Paysagiste"] },
  { icon: GraduationCap, key: "education", packs: ["École privée", "Centre de formation", "Coach / Formateur indépendant", "Auto-école"] },
  { icon: UtensilsCrossed, key: "hospitality", packs: ["Restaurant", "Hôtel / B&B", "Traiteur", "Agence de voyage"] },
  { icon: Sparkles, key: "otherServices", packs: ["Association / ONG", "Créateur de contenu", "Mode / Textile", "Transport / Logistique", "Nettoyage / Entretien", "Salon de coiffure / Beauté"] },
];

const advantageKeys = [
  { icon: Zap, key: "operational30s", highlights: ["operational30sH1", "operational30sH2", "operational30sH3"] },
  { icon: Sparkles, key: "customAI", highlights: ["customAIH1", "customAIH2", "customAIH3"] },
  { icon: ShieldCheck, key: "mergeNoOverwrite", highlights: ["mergeNoOverwriteH1", "mergeNoOverwriteH2", "mergeNoOverwriteH3"] },
  { icon: Search, key: "intuitiveSearch", highlights: ["intuitiveSearchH1", "intuitiveSearchH2", "intuitiveSearchH3"] },
];

export default function ClassementMarketing() {
  const { t } = useTranslation();
  const paymentsEnabled = isPaymentsEnabled();

  const howItWorks = [
    { step: "1", key: "step1" },
    { step: "2", key: "step2" },
    { step: "3", key: "step3" },
    { step: "4", key: "step4" },
  ];

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 via-[#2d7dd2]/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 mb-6">
            <FolderKanban className="w-3.5 h-3.5 text-[#2d7dd2]" />
            <span className="text-[12px] font-medium text-[#2d7dd2]">{t("marketing.classification.badge")}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            {t("marketing.classification.heroTitle")}
          </h1>
          <p className="mt-5 text-[15px] sm:text-[16px] text-[#b8c5d6] max-w-2xl mx-auto leading-relaxed">
            {t("marketing.classification.heroDesc")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors flex items-center gap-2">
                {paymentsEnabled ? t("marketing.classification.tryFree") : t("waitlist.ctaJoin")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/tarifs">
              <button className="px-8 py-3 text-[14px] font-semibold text-[#b8c5d6] border border-[#1f2937] rounded-lg hover:text-white hover:border-[#2d7dd2]/30 transition-colors">
                {t("marketing.classification.seePricing")}
              </button>
            </Link>
          </div>

        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.classification.familiesTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#b8c5d6] max-w-xl mx-auto">
              {t("marketing.classification.familiesDesc")}
            </p>
            <p className="mt-4 text-[13px] text-[#2d7dd2] max-w-2xl mx-auto leading-relaxed">
              {t("marketing.classification.familiesReassurance")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {familleKeys.map((f) => (
              <div
                key={f.key}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-[#2d7dd2]" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-white">{t(`marketing.classification.${f.key}`)}</h3>
                    <p className="text-[11px] text-[#b8c5d6]">{t("marketing.classification.packsCount", { count: f.packs.length })}</p>
                  </div>
                </div>
                <p className="text-[13px] text-[#b8c5d6] leading-relaxed mb-4">{t(`marketing.classification.${f.key}Desc`)}</p>
                <div className="flex flex-wrap gap-2">
                  {f.packs.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#0d1117] border border-[#1f2937] text-[11px] text-[#b8c5d6]"
                    >
                      <Package className="w-3 h-3 text-[#2d7dd2]" />
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            <div className="md:col-span-2 rounded-xl border-2 border-[#2d7dd2]/40 bg-gradient-to-br from-[#2d7dd2]/10 to-[#141c2b] p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/20 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5 text-[#2d7dd2]" />
                    </div>
                    <h3 className="text-[16px] font-semibold text-white">
                      {t("marketing.classification.notListedTitle")}
                    </h3>
                  </div>
                  <p className="text-[13px] text-[#b8c5d6] leading-relaxed">
                    {t("marketing.classification.notListedDesc")}
                  </p>
                </div>
                <Link href="/signup" className="shrink-0">
                  <button className="px-6 py-3 text-[13px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors flex items-center gap-2 whitespace-nowrap">
                    {paymentsEnabled ? t("marketing.classification.notListedCta") : t("waitlist.ctaJoin")}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.classification.advantagesTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#b8c5d6] max-w-xl mx-auto">
              {t("marketing.classification.advantagesDesc")}
            </p>
          </div>

          <div className="space-y-6">
            {advantageKeys.map((adv) => (
              <div
                key={adv.key}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 sm:p-8 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                        <adv.icon className="w-5 h-5 text-[#2d7dd2]" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-white">{t(`marketing.classification.${adv.key}`)}</h3>
                    </div>
                    <p className="text-[13px] text-[#b8c5d6] leading-relaxed">{t(`marketing.classification.${adv.key}Desc`)}</p>
                  </div>
                  <div className="lg:w-64 shrink-0">
                    <ul className="space-y-2">
                      {adv.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#2d7dd2] mt-0.5 shrink-0" />
                          <span className="text-[12px] text-[#b8c5d6]">{t(`marketing.classification.${h}`)}</span>
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
              {t("marketing.classification.howItWorksTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#b8c5d6]">
              {t("marketing.classification.howItWorksDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((w) => (
              <div key={w.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[16px] font-bold text-[#2d7dd2]">{w.step}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-2">{t(`marketing.classification.${w.key}`)}</h3>
                <p className="text-[12px] text-[#b8c5d6] leading-relaxed">{t(`marketing.classification.${w.key}Desc`)}</p>
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
              {t("marketing.classification.ctaTitle")}
            </h2>
            <p className="mt-4 text-[14px] text-[#b8c5d6] max-w-lg mx-auto">
              {t("marketing.classification.ctaDesc")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                  {paymentsEnabled ? t("marketing.classification.startFree") : t("waitlist.ctaJoin")}
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-[#b8c5d6] border border-[#1f2937] rounded-lg hover:text-white transition-colors">
                  {t("marketing.classification.seePricingAlt")}
                </button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[#b8c5d6]/60">
              {t("marketing.classification.ctaFooter")}
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
