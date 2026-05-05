import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import {
  Building2,
  Users,
  MailPlus,
  MessageSquare,
  UserPlus,
  Bell,
  Activity,
  Shield,
  Crown,
  ArrowRight,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";

const capabilityKeys = [
  { icon: Zap, key: "aiTeam", highlights: ["aiTeamH1", "aiTeamH2", "aiTeamH3", "aiTeamH4"] },
  { icon: Building2, key: "centralOrg", highlights: ["centralOrgH1", "centralOrgH2", "centralOrgH3"] },
  { icon: Crown, key: "rolesPermissions", highlights: ["rolesPermissionsH1", "rolesPermissionsH2", "rolesPermissionsH3"] },
  { icon: MailPlus, key: "sharedMailboxes", highlights: ["sharedMailboxesH1", "sharedMailboxesH2", "sharedMailboxesH3"] },
  { icon: MessageSquare, key: "internalNotes", highlights: ["internalNotesH1", "internalNotesH2", "internalNotesH3"] },
  { icon: UserPlus, key: "smartAssignment", highlights: ["smartAssignmentH1", "smartAssignmentH2", "smartAssignmentH3"] },
  { icon: Bell, key: "realTimeNotifs", highlights: ["realTimeNotifsH1", "realTimeNotifsH2", "realTimeNotifsH3"] },
  { icon: Activity, key: "activityDashboard", highlights: ["activityDashboardH1", "activityDashboardH2", "activityDashboardH3"] },
];

export default function Entreprise() {
  const { t } = useTranslation();

  const heroStats = [
    { value: t("marketing.enterprise.stats.unlimited"), label: t("marketing.enterprise.stats.teamMembers") },
    { value: t("marketing.enterprise.stats.integratedAI"), label: t("marketing.enterprise.stats.aiFeatures") },
    { value: t("marketing.enterprise.stats.realTime"), label: t("marketing.enterprise.stats.collaboration") },
  ];

  const workflow = [
    { step: "1", key: "wStep1" },
    { step: "2", key: "wStep2" },
    { step: "3", key: "wStep3" },
    { step: "4", key: "wStep4" },
  ];

  const faqs = [
    { q: t("marketing.enterprise.faq1q"), a: t("marketing.enterprise.faq1a") },
    { q: t("marketing.enterprise.faq2q"), a: t("marketing.enterprise.faq2a") },
    { q: t("marketing.enterprise.faq3q"), a: t("marketing.enterprise.faq3a") },
    { q: t("marketing.enterprise.faq4q"), a: t("marketing.enterprise.faq4a") },
    { q: t("marketing.enterprise.faq5q"), a: t("marketing.enterprise.faq5a") },
  ];

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 via-[#2d7dd2]/5 to-transparent" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 mb-6">
            <Building2 className="w-3.5 h-3.5 text-[#2d7dd2]" />
            <span className="text-[12px] font-medium text-[#2d7dd2]">{t("marketing.enterprise.badge")}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight">
            {t("marketing.enterprise.heroTitle")}
          </h1>
          <p className="mt-5 text-[15px] sm:text-[16px] text-[#b8c5d6] max-w-2xl mx-auto leading-relaxed">
            {t("marketing.enterprise.heroDesc")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/tarifs">
              <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors flex items-center gap-2">
                {t("marketing.enterprise.chooseBusiness")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/tarifs">
              <button className="px-8 py-3 text-[14px] font-semibold text-[#b8c5d6] border border-[#1f2937] rounded-lg hover:text-white hover:border-[#2d7dd2]/30 transition-colors">
                {t("marketing.enterprise.comparePlans")}
              </button>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {heroStats.map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-[11px] text-[#b8c5d6] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.enterprise.collaborateTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#b8c5d6] max-w-xl mx-auto">
              {t("marketing.enterprise.collaborateDesc")}
            </p>
          </div>

          <div className="space-y-6">
            {capabilityKeys.map((cap) => (
              <div
                key={cap.key}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 sm:p-8 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                        <cap.icon className="w-5 h-5 text-[#2d7dd2]" />
                      </div>
                      <h3 className="text-[16px] font-semibold text-white">{t(`marketing.enterprise.${cap.key}`)}</h3>
                    </div>
                    <p className="text-[13px] text-[#b8c5d6] leading-relaxed">{t(`marketing.enterprise.${cap.key}Desc`)}</p>
                  </div>
                  <div className="lg:w-64 shrink-0">
                    <ul className="space-y-2">
                      {cap.highlights.map((h) => (
                        <li key={h} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#2d7dd2] mt-0.5 shrink-0" />
                          <span className="text-[12px] text-[#b8c5d6]">{t(`marketing.enterprise.${h}`)}</span>
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
              {t("marketing.enterprise.workflowTitle")}
            </h2>
            <p className="mt-3 text-[14px] text-[#b8c5d6]">
              {t("marketing.enterprise.workflowDesc")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflow.map((w) => (
              <div key={w.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-[#2d7dd2]/10 border border-[#2d7dd2]/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-[16px] font-bold text-[#2d7dd2]">{w.step}</span>
                </div>
                <h3 className="text-[14px] font-semibold text-white mb-2">{t(`marketing.enterprise.${w.key}`)}</h3>
                <p className="text-[12px] text-[#b8c5d6] leading-relaxed">{t(`marketing.enterprise.${w.key}Desc`)}</p>
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
              {t("marketing.enterprise.ctaTitle")}
            </h2>
            <p className="mt-4 text-[14px] text-[#b8c5d6] max-w-lg mx-auto">
              {t("marketing.enterprise.ctaDesc")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                  {t("marketing.enterprise.discoverBusiness")}
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-8 py-3 text-[14px] font-semibold text-[#b8c5d6] border border-[#1f2937] rounded-lg hover:text-white transition-colors">
                  {t("marketing.enterprise.comparePlans")}
                </button>
              </Link>
            </div>
            <p className="mt-4 text-[11px] text-[#b8c5d6]/60">
              {t("marketing.enterprise.ctaFooter")}
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">
              {t("marketing.enterprise.faqTitle")}
            </h2>
          </div>
          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-5"
              >
                <h3 className="text-[14px] font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-[13px] text-[#b8c5d6] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
