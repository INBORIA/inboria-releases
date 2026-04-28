import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import {
  Users,
  ArrowRight,
  CheckCircle2,
  Building2,
  Briefcase,
  Cloud,
  Database,
  RefreshCw,
  ShieldCheck,
  Lock,
  Zap,
  Eye,
  Server,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { isPaymentsEnabled } from "@/lib/feature-flags";

const crmFeatureKeys = [
  { icon: Building2, key: "hubspot", highlights: ["hubspotH1", "hubspotH2", "hubspotH3", "hubspotH4"] },
  { icon: Briefcase, key: "pipedrive", highlights: ["pipedriveH1", "pipedriveH2", "pipedriveH3", "pipedriveH4"] },
  { icon: Cloud, key: "salesforce", highlights: ["salesforceH1", "salesforceH2", "salesforceH3", "salesforceH4"] },
  { icon: Database, key: "odoo", highlights: ["odooH1", "odooH2", "odooH3", "odooH4"] },
  { icon: RefreshCw, key: "autoSync", highlights: ["autoSyncH1", "autoSyncH2", "autoSyncH3", "autoSyncH4"] },
  { icon: Lock, key: "secureOauth", highlights: ["secureOauthH1", "secureOauthH2", "secureOauthH3", "secureOauthH4"] },
];

const principleKeys = [
  { icon: Eye, key: "transparency" },
  { icon: ShieldCheck, key: "noLockIn" },
  { icon: ShieldCheck, key: "gdprCompliant" },
  { icon: Server, key: "secureInfra" },
];

export default function CRM() {
  const { t } = useTranslation();
  const paymentsEnabled = isPaymentsEnabled();

  const heroStats = [
    { value: t("marketing.crm.stats.crmCount"), label: t("marketing.crm.stats.crmCountLabel") },
    { value: t("marketing.crm.stats.frequency"), label: t("marketing.crm.stats.frequencyLabel") },
    { value: t("marketing.crm.stats.bidir"), label: t("marketing.crm.stats.bidirLabel") },
  ];

  const howItWorks = [
    { step: "1", key: "step1" },
    { step: "2", key: "step2" },
    { step: "3", key: "step3" },
    { step: "4", key: "step4" },
  ];

  const faqs = [
    { q: t("marketing.crm.faq1q"), a: t("marketing.crm.faq1a") },
    { q: t("marketing.crm.faq2q"), a: t("marketing.crm.faq2a") },
    { q: t("marketing.crm.faq3q"), a: t("marketing.crm.faq3a") },
    { q: t("marketing.crm.faq4q"), a: t("marketing.crm.faq4a") },
    { q: t("marketing.crm.faq5q"), a: t("marketing.crm.faq5a") },
  ];

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 via-[#2d7dd2]/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 mb-6">
            <Users className="w-3.5 h-3.5 text-[#2d7dd2]" />
            <span className="text-[12px] font-medium text-[#2d7dd2]" data-testid="text-crm-badge">{t("marketing.crm.badge")}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight" data-testid="text-crm-hero-title">
            {t("marketing.crm.heroTitle")}
          </h1>
          <p className="mt-5 text-[15px] sm:text-[16px] text-[#8b9cb3] max-w-2xl mx-auto leading-relaxed">
            {t("marketing.crm.heroDesc")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/signup">
              <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors flex items-center gap-2" data-testid="button-crm-try">
                {paymentsEnabled ? t("marketing.crm.tryFree") : t("waitlist.ctaJoin")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/fonctionnalites">
              <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white hover:border-[#2d7dd2]/30 transition-colors" data-testid="button-crm-features">
                {t("marketing.crm.allFeatures")}
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
              {t("marketing.crm.whatItDoes")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              {t("marketing.crm.whatItDoesDesc")}
            </p>
          </div>

          <div className="space-y-6">
            {crmFeatureKeys.map((feat) => (
              <div
                key={feat.key}
                data-testid={`card-crm-${feat.key}`}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 sm:p-8 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                        <feat.icon className="w-5 h-5 text-[#2d7dd2]" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-white">{t(`marketing.crm.${feat.key}`)}</h3>
                    </div>
                    <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{t(`marketing.crm.${feat.key}Desc`)}</p>
                  </div>
                  <div className="lg:w-64 shrink-0">
                    <ul className="space-y-2">
                      {feat.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#2d7dd2] mt-0.5 shrink-0" />
                          <span className="text-[12px] text-[#8b9cb3]">{t(`marketing.crm.${h}`)}</span>
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
              {t("marketing.crm.howItWorks")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3]">
              {t("marketing.crm.howItWorksDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((w) => (
              <div key={w.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[16px] font-bold text-[#2d7dd2]">{w.step}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-2">{t(`marketing.crm.${w.key}`)}</h3>
                <p className="text-[12px] text-[#8b9cb3] leading-relaxed">{t(`marketing.crm.${w.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.crm.securityTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#8b9cb3] max-w-xl mx-auto">
              {t("marketing.crm.securityDesc")}
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
                  <h3 className="text-[15px] font-semibold text-white">{t(`marketing.crm.${p.key}`)}</h3>
                </div>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{t(`marketing.crm.${p.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.crm.faqTitle")}
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
          <p className="mt-10 text-[11px] text-[#5d6b7e] leading-relaxed text-center">
            {t("marketing.crm.trademarkNotice")}
          </p>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="rounded-2xl border border-[#2d7dd2]/20 bg-gradient-to-br from-[#141c2b] to-[#0d1117] p-8 sm:p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#2d7dd2]/10 flex items-center justify-center mx-auto mb-6">
              <Zap className="w-7 h-7 text-[#2d7dd2]" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.crm.ctaTitle")}
            </h2>
            <p className="mt-4 text-[14px] text-[#8b9cb3] max-w-lg mx-auto">
              {t("marketing.crm.ctaDesc")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup">
                <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors" data-testid="button-crm-cta-try">
                  {paymentsEnabled ? t("marketing.crm.tryFree") : t("waitlist.ctaJoin")}
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-[#8b9cb3] border border-[#1f2937] rounded-lg hover:text-white transition-colors" data-testid="button-crm-cta-pricing">
                  {t("marketing.crm.seePricing")}
                </button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[#8b9cb3]/60">
              {t("marketing.crm.ctaFooter")}
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
