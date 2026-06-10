import { Link, useLocation } from "wouter";
import appLogo from "@assets/inboria_logo_cropped_1780520000000.png";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: t("nav.home"), href: "/" },
    { label: t("nav.features"), href: "/fonctionnalites" },
    { label: t("nav.extensions"), href: "/extensions" },
    { label: "Télécharger", href: "/telecharger" },
    { label: t("nav.classification"), href: "/classement" },
    { label: t("nav.ai"), href: "/inboria" },
    { label: t("nav.crm"), href: "/crm" },
    { label: t("nav.enterprise"), href: "/entreprise" },
    { label: t("nav.pricing"), href: "/tarifs" },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-white flex flex-col">
      <header className="sticky top-0 z-50 bg-[#0d1117]/95 backdrop-blur-sm border-b border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-40">
            <Link href="/" className="flex items-center shrink-0 -ml-1 sm:-ml-2">
              <img src={appLogo} alt="Inboria" className="h-24 sm:h-28 lg:h-32 w-auto max-w-none object-contain" />
            </Link>

            <nav className="hidden md:flex items-center gap-5 ml-4 lg:ml-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[14px] font-medium transition-colors ${
                    location === link.href ? "text-[#2d7dd2]" : "text-[#b8c5d6] hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-3">
              <LanguageSwitcher />
              <Link href="/login">
                <button className="px-4 py-2 text-[13px] font-medium text-[#2d7dd2] border border-[#2d7dd2] rounded-lg hover:bg-[#2d7dd2]/10 transition-colors">
                  {t("nav.login")}
                </button>
              </Link>
              <Link href="/tarifs">
                <button className="px-4 py-2 text-[13px] font-medium text-white bg-[#2d7dd2] rounded-lg hover:bg-[#2563b1] transition-colors">
                  {t("nav.signup")}
                </button>
              </Link>
            </div>

            <button
              className="md:hidden text-white p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {mobileOpen && (
            <div className="md:hidden pb-4 border-t border-[#1f2937] pt-4 space-y-3">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block text-[14px] font-medium px-2 py-1.5 rounded ${
                    location === link.href ? "text-[#2d7dd2]" : "text-[#b8c5d6]"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="px-2 pt-1">
                <LanguageSwitcher />
              </div>
              <div className="flex gap-3 pt-2">
                <Link href="/login" className="flex-1">
                  <button className="w-full px-4 py-2 text-[13px] font-medium text-[#2d7dd2] border border-[#2d7dd2] rounded-lg" onClick={() => setMobileOpen(false)}>
                    {t("nav.login")}
                  </button>
                </Link>
                <Link href="/tarifs" className="flex-1">
                  <button className="w-full px-4 py-2 text-[13px] font-medium text-white bg-[#2d7dd2] rounded-lg" onClick={() => setMobileOpen(false)}>
                    {t("nav.signup")}
                  </button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#1f2937] bg-[#0a0e14]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-start mb-3">
                <img src={appLogo} alt="Inboria" className="h-9 w-auto object-contain" />
              </div>
            </div>

            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3">{t("footer.legalInfo")}</h4>
              <div className="space-y-2">
                <Link href="/mentions-legales" className="block text-[13px] text-[#b8c5d6] hover:text-white transition-colors">
                  {t("footer.legalNotice")}
                </Link>
                <Link href="/confidentialite" className="block text-[13px] text-[#b8c5d6] hover:text-white transition-colors">
                  {t("footer.privacyPolicy")}
                </Link>
                <Link href="/conditions" className="block text-[13px] text-[#b8c5d6] hover:text-white transition-colors">
                  {t("footer.termsOfUse")}
                </Link>
                <Link href="/login" className="block text-[13px] text-[#b8c5d6] hover:text-white transition-colors">
                  {t("footer.accessAccount")}
                </Link>
              </div>
            </div>

            <div>
              <h4 className="text-[13px] font-semibold text-white mb-3">{t("footer.contact")}</h4>
              <a href="mailto:support@inboria.com" className="text-[13px] text-[#b8c5d6] hover:text-white transition-colors">
                support@inboria.com
              </a>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#1f2937] text-center">
            <p className="text-[12px] text-[#b8c5d6]">{t("footer.allRightsReserved")}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
