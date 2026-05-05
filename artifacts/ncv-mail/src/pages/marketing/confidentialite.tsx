import { MarketingLayout } from "@/components/layout/marketing-layout";
import { useTranslation } from "react-i18next";

export default function Confidentialite() {
  const { t } = useTranslation();

  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">{t("marketing.legal.privacyTitle")}</h1>

        <div className="space-y-8 text-[14px] text-[#b8c5d6] leading-relaxed">
          <div>
            <h2 className="text-[16px] font-semibold text-white mb-2">{t("marketing.legal.dataController")}</h2>
            <p>{t("marketing.legal.betaPlaceholder")}</p>
            <p className="mt-2">{t("marketing.legal.contactEmail")} : <a href="mailto:support@inboria.com" className="text-[#2d7dd2] hover:underline">support@inboria.com</a></p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.dataCollected")}</h2>
            <p className="mb-2">{t("marketing.legal.dataCollectedIntro")}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t("marketing.legal.dataEmail")}</li>
              <li>{t("marketing.legal.dataName")}</li>
              <li>{t("marketing.legal.dataAuth")}</li>
              <li>{t("marketing.legal.dataContent")}</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.dataUsage")}</h2>
            <p className="mb-2">{t("marketing.legal.dataUsageIntro")}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t("marketing.legal.dataUsageAI")}</li>
              <li>{t("marketing.legal.dataUsageBilling")}</li>
              <li>{t("marketing.legal.dataUsageImprovement")}</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.retention")}</h2>
            <p>{t("marketing.legal.retentionActive")}</p>
            <p className="mt-2">{t("marketing.legal.retentionDeletion")}</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.gdprRights")}</h2>
            <p className="mb-2">{t("marketing.legal.gdprRightsIntro")}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-white">{t("marketing.legal.rightAccess")} :</strong> {t("marketing.legal.rightAccessDesc")}</li>
              <li><strong className="text-white">{t("marketing.legal.rightRectification")} :</strong> {t("marketing.legal.rightRectificationDesc")}</li>
              <li><strong className="text-white">{t("marketing.legal.rightErasure")} :</strong> {t("marketing.legal.rightErasureDesc")}</li>
              <li><strong className="text-white">{t("marketing.legal.rightPortability")} :</strong> {t("marketing.legal.rightPortabilityDesc")}</li>
            </ul>
            <p className="mt-3">{t("marketing.legal.exerciseRights")} : <a href="mailto:support@inboria.com" className="text-[#2d7dd2] hover:underline">support@inboria.com</a></p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
