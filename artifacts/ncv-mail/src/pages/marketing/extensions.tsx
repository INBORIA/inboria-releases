import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Mail, MailPlus, Globe, Smartphone, Puzzle, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isPaymentsEnabled } from "@/lib/feature-flags";

export default function Extensions() {
  const { t } = useTranslation();
  const paymentsEnabled = isPaymentsEnabled();

  const bridges = [
    { icon: Mail, key: "outlook", tags: ["Outlook", "Microsoft 365", "Exchange"] },
    { icon: MailPlus, key: "gmail", tags: ["Gmail", "Google Workspace"] },
    { icon: Globe, key: "webmail", tags: ["OVH", "Yahoo", "iCloud", "IMAP"] },
    { icon: Smartphone, key: "app", tags: ["Web", "iOS", "Android"] },
  ];

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#2d7dd2]/30 bg-[#2d7dd2]/10 text-[#2d7dd2] text-[12px] font-medium mb-5">
            <Puzzle className="w-3.5 h-3.5" />
            {t("marketing.extensions.eyebrow")}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            {t("marketing.extensions.heroTitle")}
          </h1>
          <p className="mt-4 text-[16px] text-[#b8c5d6] max-w-2xl mx-auto">
            {t("marketing.extensions.heroDesc")}
          </p>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {bridges.map((b) => (
              <div
                key={b.key}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center mb-4">
                  <b.icon className="w-5 h-5 text-[#2d7dd2]" />
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">
                  {t(`marketing.extensions.${b.key}Title`)}
                </h3>
                <p className="text-[13px] text-[#b8c5d6] leading-relaxed">
                  {t(`marketing.extensions.${b.key}Desc`)}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {b.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-[#1f2937] text-[#b8c5d6] text-[11px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#2d7dd2]/10 flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-6 h-6 text-[#2d7dd2]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {t("marketing.extensions.howTitle")}
          </h2>
          <p className="text-[14px] text-[#b8c5d6] mt-3">
            {t("marketing.extensions.howDesc")}
          </p>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {t("marketing.extensions.ctaTitle")}
          </h2>
          <p className="text-[14px] text-[#b8c5d6] mt-3">
            {t("marketing.extensions.ctaDesc")}
          </p>
          <Link href="/signup">
            <button className="mt-6 px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
              {paymentsEnabled ? t("marketing.extensions.cta") : t("waitlist.ctaJoin")}
            </button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
