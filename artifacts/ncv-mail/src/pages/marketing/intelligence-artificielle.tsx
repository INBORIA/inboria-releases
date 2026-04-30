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
  MessageSquare,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { isPaymentsEnabled } from "@/lib/feature-flags";

const aiFeatureKeys = [
  { icon: Brain, key: "memory", highlights: ["memoryH1", "memoryH2", "memoryH3", "memoryH4"] },
  { icon: Tags, key: "autoSort", highlights: ["autoSortH1", "autoSortH2", "autoSortH3", "autoSortH4"] },
  { icon: FileText, key: "smartSummaries", highlights: ["smartSummariesH1", "smartSummariesH2", "smartSummariesH3", "smartSummariesH4"] },
  { icon: PenLine, key: "aiDrafts", highlights: ["aiDraftsH1", "aiDraftsH2", "aiDraftsH3", "aiDraftsH4"] },
  { icon: BarChart3, key: "dailyBrief", highlights: ["dailyBriefH1", "dailyBriefH2", "dailyBriefH3", "dailyBriefH4"] },
  { icon: AlertTriangle, key: "priorityDetection", highlights: ["priorityDetectionH1", "priorityDetectionH2", "priorityDetectionH3", "priorityDetectionH4"] },
  { icon: FolderKanban, key: "aiPacks", highlights: ["aiPacksH1", "aiPacksH2", "aiPacksH3", "aiPacksH4"] },
];

const assistantHighlights = ["assistantH1", "assistantH2", "assistantH3", "assistantH4"];

const principleKeys = [
  { icon: Eye, key: "transparency" },
  { icon: Lock, key: "yourData" },
  { icon: ShieldCheck, key: "gdprCompliant" },
  { icon: Server, key: "secureInfra" },
];

export default function IntelligenceArtificielle() {
  const { t } = useTranslation();
  const paymentsEnabled = isPaymentsEnabled();

  const heroStats = [
    { value: t("marketing.ai.stats.advancedAI"), label: t("marketing.ai.stats.latestGen") },
    { value: "<3s", label: t("marketing.ai.stats.processingTime") },
    { value: "RGPD", label: t("marketing.ai.stats.gdpr") },
  ];

  const howItWorks = [
    { step: "1", key: "step1" },
    { step: "2", key: "step2" },
    { step: "3", key: "step3" },
    { step: "4", key: "step4" },
  ];

  const faqs = [
    { q: t("marketing.ai.faq1q"), a: t("marketing.ai.faq1a") },
    { q: t("marketing.ai.faq2q"), a: t("marketing.ai.faq2a") },
    { q: t("marketing.ai.faq3q"), a: t("marketing.ai.faq3a") },
    { q: t("marketing.ai.faq4q"), a: t("marketing.ai.faq4a") },
    { q: t("marketing.ai.faq5q"), a: t("marketing.ai.faq5a") },
  ];

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 via-[#2d7dd2]/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 mb-6">
            <Brain className="w-3.5 h-3.5 text-[#2d7dd2]" />
            <span className="text-[12px] font-medium text-[#2d7dd2]">{t("marketing.ai.badge")}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            {t("marketing.ai.heroTitle")}
          </h1>
          <p className="mt-5 text-[15px] sm:text-[16px] text-[#8b9cb3] max-w-2xl mx-auto leading-relaxed">
            {t("marketing.ai.heroDesc")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors flex items-center gap-2">
                {paymentsEnabled ? t("marketing.ai.tryAIFree") : t("waitlist.ctaJoin")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/fonctionnalites">
              <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white hover:border-[#2d7dd2]/30 transition-colors">
                {t("marketing.ai.allFeatures")}
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
              {t("marketing.ai.whatAIDoes")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              {t("marketing.ai.whatAIDoesDesc")}
            </p>
          </div>

          <div className="space-y-6">
            {aiFeatureKeys.map((feat) => (
              <div
                key={feat.key}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 sm:p-8 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                        <feat.icon className="w-5 h-5 text-[#2d7dd2]" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-white">{t(`marketing.ai.${feat.key}`)}</h3>
                    </div>
                    <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{t(`marketing.ai.${feat.key}Desc`)}</p>
                  </div>
                  <div className="lg:w-64 shrink-0">
                    <ul className="space-y-2">
                      {feat.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#2d7dd2] mt-0.5 shrink-0" />
                          <span className="text-[12px] text-[#8b9cb3]">{t(`marketing.ai.${h}`)}</span>
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
              {t("marketing.ai.howAIWorks")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3]">
              {t("marketing.ai.howAIWorksDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((w) => (
              <div key={w.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[16px] font-bold text-[#2d7dd2]">{w.step}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-2">{t(`marketing.ai.${w.key}`)}</h3>
                <p className="text-[12px] text-[#8b9cb3] leading-relaxed">{t(`marketing.ai.${w.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="rounded-2xl border border-[#2d7dd2]/20 bg-gradient-to-br from-[#141c2b] to-[#0d1117] p-8 sm:p-12">
            <div className="flex flex-col lg:flex-row lg:items-start gap-8">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-6 h-6 text-[#2d7dd2]" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white">
                      {t("marketing.ai.assistantTitle")}
                    </h2>
                    <p className="text-[13px] text-[#2d7dd2] mt-0.5">
                      {t("marketing.ai.assistantSubtitle")}
                    </p>
                  </div>
                </div>
                <p className="text-[14px] text-[#8b9cb3] leading-relaxed">
                  {t("marketing.ai.assistantDesc")}
                </p>
              </div>
              <div className="lg:w-72 shrink-0">
                <ul className="space-y-2">
                  {assistantHighlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-[#2d7dd2] mt-0.5 shrink-0" />
                      <span className="text-[12px] text-[#8b9cb3]">{t(`marketing.ai.${h}`)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.ai.securityTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              {t("marketing.ai.securityDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {principleKeys.map((p) => (
              <div
                key={p.key}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                    <p.icon className="w-5 h-5 text-[#2d7dd2]" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-white">{t(`marketing.ai.${p.key}`)}</h3>
                </div>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{t(`marketing.ai.${p.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.ai.faqTitle")}
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
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
              {t("marketing.ai.ctaTitle")}
            </h2>
            <p className="mt-4 text-[14px] text-[#8b9cb3] max-w-lg mx-auto">
              {t("marketing.ai.ctaDesc")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                  {paymentsEnabled ? t("marketing.ai.tryFree") : t("waitlist.ctaJoin")}
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white transition-colors">
                  {t("marketing.ai.seePricing")}
                </button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[#8b9cb3]/60">
              {t("marketing.ai.ctaFooter")}
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
