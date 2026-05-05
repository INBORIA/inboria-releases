import { MarketingLayout } from "@/components/layout/marketing-layout";
import { useTranslation } from "react-i18next";

export default function Conditions() {
  const { t } = useTranslation();

  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-8">{t("marketing.legal.termsTitle")}</h1>

        <div className="space-y-8 text-[14px] text-[#b8c5d6] leading-relaxed">
          <div>
            <h2 className="text-[16px] font-semibold text-white mb-2">{t("marketing.legal.serviceEditor")}</h2>
            <p>{t("marketing.legal.betaPlaceholder")}</p>
            <p className="mt-2">{t("marketing.legal.contactEmail")} : <a href="mailto:support@inboria.com" className="text-[#2d7dd2] hover:underline">support@inboria.com</a></p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.serviceDescription")}</h2>
            <p>{t("marketing.legal.serviceDescText")}</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.accountAccess")}</h2>
            <p>{t("marketing.legal.accountAccessText1")}</p>
            <p className="mt-2">{t("marketing.legal.accountAccessText2")}</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.userObligations")}</h2>
            <p className="mb-2">{t("marketing.legal.userObligationsIntro")}</p>
            <p className="mb-2">{t("marketing.legal.userObligationsForbidden")}</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>{t("marketing.legal.userObl1")}</li>
              <li>{t("marketing.legal.userObl2")}</li>
              <li>{t("marketing.legal.userObl3")}</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.liability")}</h2>
            <p>{t("marketing.legal.liabilityText1")}</p>
            <p className="mt-2">{t("marketing.legal.liabilityText2")}</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.ip")}</h2>
            <p>{t("marketing.legal.ipText1")}</p>
            <p className="mt-2">{t("marketing.legal.ipText2")}</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.termination")}</h2>
            <p>{t("marketing.legal.terminationText1")}</p>
            <p className="mt-2">{t("marketing.legal.terminationText2")}</p>
          </div>

          <div>
            <h2 className="text-[16px] font-semibold text-white mb-3">{t("marketing.legal.jurisdiction")}</h2>
            <p>{t("marketing.legal.jurisdictionText")}</p>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
