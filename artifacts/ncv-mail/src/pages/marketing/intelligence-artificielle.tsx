import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import {
  MessageSquare,
  ArrowRight,
  Users,
  Calendar,
  Settings,
  History,
  Eye,
  Lock,
  ShieldCheck,
  Server,
  Zap,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { isPaymentsEnabled } from "@/lib/feature-flags";

const knowsKeys = [
  { icon: Users, key: "knows1" },
  { icon: Calendar, key: "knows2" },
  { icon: Settings, key: "knows3" },
  { icon: History, key: "knows4" },
];

const askExamples = ["ask1", "ask2", "ask3", "ask4", "ask5", "ask6"];

const stepsKeys = [
  { step: "1", key: "step1" },
  { step: "2", key: "step2" },
  { step: "3", key: "step3" },
  { step: "4", key: "step4" },
];

const privacyKeys = [
  { icon: Eye, key: "privacy1" },
  { icon: Lock, key: "privacy2" },
  { icon: ShieldCheck, key: "privacy3" },
  { icon: Server, key: "privacy4" },
];

export default function IntelligenceArtificielle() {
  const { t } = useTranslation();
  const paymentsEnabled = isPaymentsEnabled();

  const heroStats = [
    { value: t("marketing.inboriaChat.heroStat1Value"), label: t("marketing.inboriaChat.heroStat1Label") },
    { value: t("marketing.inboriaChat.heroStat2Value"), label: t("marketing.inboriaChat.heroStat2Label") },
    { value: t("marketing.inboriaChat.heroStat3Value"), label: t("marketing.inboriaChat.heroStat3Label") },
  ];

  const faqs = [
    { q: t("marketing.inboriaChat.faq1q"), a: t("marketing.inboriaChat.faq1a") },
    { q: t("marketing.inboriaChat.faq2q"), a: t("marketing.inboriaChat.faq2a") },
    { q: t("marketing.inboriaChat.faq3q"), a: t("marketing.inboriaChat.faq3a") },
    { q: t("marketing.inboriaChat.faq4q"), a: t("marketing.inboriaChat.faq4a") },
    { q: t("marketing.inboriaChat.faq5q"), a: t("marketing.inboriaChat.faq5a") },
  ];

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 via-[#2d7dd2]/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 mb-6">
            <MessageSquare className="w-3.5 h-3.5 text-[#2d7dd2]" />
            <span className="text-[12px] font-medium text-[#2d7dd2]">{t("marketing.inboriaChat.badge")}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            {t("marketing.inboriaChat.heroTitle")}
          </h1>
          <p className="mt-5 text-[15px] sm:text-[16px] text-[#8b9cb3] max-w-2xl mx-auto leading-relaxed">
            {t("marketing.inboriaChat.heroDesc")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors flex items-center gap-2">
                {paymentsEnabled ? t("marketing.inboriaChat.tryFree") : t("waitlist.ctaJoin")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/tarifs">
              <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white hover:border-[#2d7dd2]/30 transition-colors">
                {t("marketing.inboriaChat.seePricing")}
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
              {t("marketing.inboriaChat.knowsTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              {t("marketing.inboriaChat.knowsDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {knowsKeys.map((k) => (
              <div
                key={k.key}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                    <k.icon className="w-5 h-5 text-[#2d7dd2]" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-white">
                    {t(`marketing.inboriaChat.${k.key}Title`)}
                  </h3>
                </div>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">
                  {t(`marketing.inboriaChat.${k.key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.inboriaChat.askTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              {t("marketing.inboriaChat.askDesc")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {askExamples.map((k) => (
              <div
                key={k}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-5 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-[#2d7dd2]" />
                </div>
                <p className="text-[14px] text-white leading-relaxed">
                  « {t(`marketing.inboriaChat.${k}`)} »
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.inboriaChat.howTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3]">
              {t("marketing.inboriaChat.howDesc")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {stepsKeys.map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[16px] font-bold text-[#2d7dd2]">{s.step}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-2">
                  {t(`marketing.inboriaChat.${s.key}`)}
                </h3>
                <p className="text-[12px] text-[#8b9cb3] leading-relaxed">
                  {t(`marketing.inboriaChat.${s.key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.inboriaChat.privacyTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              {t("marketing.inboriaChat.privacyDesc")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {privacyKeys.map((p) => (
              <div
                key={p.key}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                    <p.icon className="w-5 h-5 text-[#2d7dd2]" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-white">
                    {t(`marketing.inboriaChat.${p.key}`)}
                  </h3>
                </div>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">
                  {t(`marketing.inboriaChat.${p.key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.inboriaChat.faqTitle")}
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
              {t("marketing.inboriaChat.ctaTitle")}
            </h2>
            <p className="mt-4 text-[14px] text-[#8b9cb3] max-w-lg mx-auto">
              {t("marketing.inboriaChat.ctaDesc")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                  {paymentsEnabled ? t("marketing.inboriaChat.tryFree") : t("waitlist.ctaJoin")}
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white transition-colors">
                  {t("marketing.inboriaChat.seePricing")}
                </button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[#8b9cb3]/60">
              {t("marketing.inboriaChat.ctaFooter")}
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
