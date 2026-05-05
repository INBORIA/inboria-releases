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
  Plug,
  BellOff,
  MailCheck,
  Users,
  CalendarDays,
  MailPlus,
  Activity,
  Bell,
  Languages,
  Bot,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { isPaymentsEnabled } from "@/lib/feature-flags";

export default function Fonctionnalites() {
  const { t } = useTranslation();
  const paymentsEnabled = isPaymentsEnabled();

  const features = [
    { icon: Tags, key: "smartSort" },
    { icon: FileText, key: "autoSummary" },
    { icon: PenLine, key: "aiDrafts" },
    { icon: BarChart3, key: "dailyBrief" },
    { icon: CheckSquare, key: "taskExtraction" },
    { icon: FolderKanban, key: "projectManagement" },
    { icon: Inbox, key: "multiMailbox" },
    { icon: Signature, key: "emailSignature" },
    { icon: Archive, key: "smartArchive" },
    { icon: AlertTriangle, key: "priorityDetection" },
    { icon: Smartphone, key: "mobileApp" },
    { icon: Shield, key: "security" },
    { icon: BellOff, key: "snoozeSchedule" },
    { icon: MailCheck, key: "aiFollowups" },
    { icon: CalendarDays, key: "agenda" },
    { icon: MailPlus, key: "sharedMailboxes" },
    { icon: Activity, key: "teamWork" },
    { icon: Bell, key: "realtimeNotifications" },
    { icon: Languages, key: "multilingual" },
    { icon: Bot, key: "autopilotMode" },
  ];

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            {t("marketing.features.heroTitle")}
          </h1>
          <p className="mt-4 text-[16px] text-[#b8c5d6] max-w-2xl mx-auto">
            {t("marketing.features.heroDesc")}
          </p>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.key}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center mb-4">
                  <f.icon className="w-5 h-5 text-[#2d7dd2]" />
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">{t(`marketing.features.${f.key}`)}</h3>
                <p className="text-[13px] text-[#b8c5d6] leading-relaxed">{t(`marketing.features.${f.key}Desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">{t("marketing.features.ctaTitle")}</h2>
          <p className="text-[14px] text-[#b8c5d6] mt-3">
            {t("marketing.features.ctaDesc")}
          </p>
          <Link href="/signup">
            <button className="mt-6 px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
              {paymentsEnabled ? t("marketing.features.tryFree") : t("waitlist.ctaJoin")}
            </button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
