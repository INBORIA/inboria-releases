import { Link } from "wouter";
import { MarketingLayout } from "@/components/layout/marketing-layout";
import { AnimatedDemo } from "@/components/marketing/animated-demo";
import { Mail, Tags, Zap, Clock, Eye, Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Accueil() {
  const { t } = useTranslation();

  const steps = [
    {
      num: "01",
      icon: Mail,
      title: t("marketing.home.step1Title"),
      desc: t("marketing.home.step1Desc"),
    },
    {
      num: "02",
      icon: Tags,
      title: t("marketing.home.step2Title"),
      desc: t("marketing.home.step2Desc"),
    },
    {
      num: "03",
      icon: Zap,
      title: t("marketing.home.step3Title"),
      desc: t("marketing.home.step3Desc"),
    },
  ];

  const benefits = [
    {
      icon: Clock,
      title: t("marketing.home.timeSaving"),
      desc: t("marketing.home.timeSavingDesc"),
    },
    {
      icon: Tags,
      title: t("marketing.home.customization"),
      desc: t("marketing.home.customizationDesc"),
    },
    {
      icon: Shield,
      title: t("marketing.home.dataSecurity"),
      desc: t("marketing.home.dataSecurityDesc"),
    },
    {
      icon: Eye,
      title: t("marketing.home.clearVision"),
      desc: t("marketing.home.clearVisionDesc"),
    },
  ];

  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 text-center relative">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">
            <span className="text-white">{t("marketing.home.heroTitle1")}</span><br />
            <span className="text-white">{t("marketing.home.heroTitle2")}</span><br />
            <span className="text-[#2d7dd2]">{t("marketing.home.heroTitle3")}</span>
          </h1>
          <p className="mt-6 text-[16px] sm:text-[18px] text-[#8b9cb3] max-w-2xl mx-auto leading-relaxed">
            {t("marketing.home.heroDesc")}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <button className="px-6 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                {t("marketing.home.startFree")}
              </button>
            </Link>
          </div>

          <AnimatedDemo />
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{t("marketing.home.howItWorks")}</h2>
            <p className="text-[14px] text-[#8b9cb3] mt-2">
              {t("marketing.home.howItWorksDesc")}
            </p>
          </div>
          <div className="space-y-8">
            {steps.map((step) => (
              <div key={step.num} className="flex items-start gap-6">
                <span className="text-4xl sm:text-5xl font-extrabold text-[#2d7dd2]/20 shrink-0 leading-none">{step.num}</span>
                <div className="flex items-start gap-4 pt-1">
                  <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center shrink-0">
                    <step.icon className="w-5 h-5 text-[#2d7dd2]" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-semibold text-white">{step.title}</h3>
                    <p className="text-[14px] text-[#8b9cb3] mt-1 max-w-lg">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <p className="text-[14px] text-[#8b9cb3]">
              {t("marketing.home.trustTitle")}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map((b, i) => (
              <div key={i} className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 hover:border-[#2d7dd2]/30 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[#2d7dd2]/10 flex items-center justify-center mb-4">
                  <b.icon className="w-5 h-5 text-[#2d7dd2]" />
                </div>
                <h3 className="text-[15px] font-semibold text-white mb-2">{b.title}</h3>
                <p className="text-[13px] text-[#8b9cb3] leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">{t("marketing.home.ctaTitle")}</h2>
          <p className="text-[14px] text-[#8b9cb3] mt-3">
            {t("marketing.home.ctaDesc")}
          </p>
          <Link href="/signup">
            <button className="mt-6 px-8 py-3 text-[14px] font-semibold text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
              {t("marketing.home.tryFree")}
            </button>
          </Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
