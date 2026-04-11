import { MarketingLayout } from "@/components/layout/marketing-layout";
import { useTranslation } from "react-i18next";

export default function MentionsLegales() {
  const { t } = useTranslation();

  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">{t("marketing.legal.legalNoticeTitle")}</h1>

        <div className="space-y-6 text-[14px] text-[#8b9cb3] leading-relaxed">
          <div>
            <h2 className="text-[16px] font-semibold text-white mb-2">{t("marketing.legal.siteEditor")}</h2>
            <p>{t("marketing.legal.companyName")}</p>
            <p>{t("marketing.legal.headquarters")}</p>
            <p>{t("marketing.legal.bceNumberShort")}</p>
            <p>{t("marketing.legal.contactEmail")} : <a href="mailto:contact@inboria.com" className="text-[#2d7dd2] hover:underline">contact@inboria.com</a></p>
          </div>

        </div>
      </div>
    </MarketingLayout>
  );
}
