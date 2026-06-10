import { MarketingLayout } from "@/components/layout/marketing-layout";
import { Monitor, Apple, Download, Smartphone, Globe, Check } from "lucide-react";

// URL de la page « dernière version » des installateurs (Release GitHub).
// Dépôt : INBORIA/inboria-app — la Release est créée automatiquement par le
// pipeline .github/workflows/desktop-build.yml au push d'un tag (ex: v1.0.0).
const RELEASES_URL = "https://github.com/INBORIA/inboria-app/releases/latest";

const desktopApps = [
  {
    icon: Monitor,
    name: "Windows",
    detail: "Windows 10 et 11 · installateur .exe",
    href: RELEASES_URL,
  },
  {
    icon: Apple,
    name: "macOS",
    detail: "macOS 11 et plus · fichier .dmg",
    href: RELEASES_URL,
  },
  {
    icon: Monitor,
    name: "Linux",
    detail: "AppImage et .deb (Debian / Ubuntu)",
    href: RELEASES_URL,
  },
];

export default function Telecharger() {
  return (
    <MarketingLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#2d7dd2]/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#2d7dd2]/30 bg-[#2d7dd2]/10 text-[#2d7dd2] text-[12px] font-medium mb-5">
            <Download className="w-3.5 h-3.5" />
            Inboria sur tous vos appareils
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Téléchargez Inboria
          </h1>
          <p className="mt-4 text-[16px] text-[#b8c5d6] max-w-2xl mx-auto">
            La même boîte mail intelligente, partout : sur votre ordinateur, sur
            le web et bientôt sur l'App Store et le Play Store.
          </p>
        </div>
      </section>

      {/* Application de bureau */}
      <section className="border-t border-[#1f2937]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white">
              Application de bureau
            </h2>
            <p className="mt-2 text-[14px] text-[#b8c5d6]">
              Application native pour Windows, macOS et Linux — rapide,
              intégrée à votre système et accessible en un clic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {desktopApps.map((apporg) => (
              <div
                key={apporg.name}
                className="rounded-xl border border-[#1f2937] bg-[#141c2b] p-6 flex flex-col items-center text-center hover:border-[#2d7dd2]/30 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-[#2d7dd2]/10 flex items-center justify-center mb-4">
                  <apporg.icon className="w-6 h-6 text-[#2d7dd2]" />
                </div>
                <h3 className="text-[16px] font-semibold text-white">
                  {apporg.name}
                </h3>
                <p className="mt-1 mb-5 text-[12px] text-[#b8c5d6]">
                  {apporg.detail}
                </p>
                <a
                  href={apporg.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2d7dd2] hover:bg-[#2569b0] text-white text-[13px] font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Installation directe depuis le navigateur (PWA) */}
      <section className="border-t border-[#1f2937]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="rounded-2xl border border-[#1f2937] bg-[#141c2b] p-8 sm:p-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 shrink-0 rounded-xl bg-[#2d7dd2]/10 flex items-center justify-center">
                <Globe className="w-6 h-6 text-[#2d7dd2]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Installer directement depuis votre navigateur
                </h2>
                <p className="mt-2 text-[14px] text-[#b8c5d6] leading-relaxed">
                  Pas besoin d'attendre : ouvrez Inboria dans Chrome, Edge ou
                  Safari, puis ajoutez-le à votre ordinateur en un clic.
                </p>
                <ul className="mt-4 space-y-2 text-[13px] text-[#b8c5d6]">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#2d7dd2]" />
                    Chrome / Edge : icône « Installer » dans la barre
                    d'adresse, à droite.
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#2d7dd2]" />
                    Safari (Mac) : menu Fichier → « Ajouter au Dock ».
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#2d7dd2]" />
                    L'icône Inboria apparaît ensuite sur votre bureau.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mobile */}
      <section className="border-t border-[#1f2937]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <div className="w-12 h-12 rounded-xl bg-[#2d7dd2]/10 flex items-center justify-center mx-auto mb-5">
            <Smartphone className="w-6 h-6 text-[#2d7dd2]" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            Sur mobile
          </h2>
          <p className="mt-2 text-[14px] text-[#b8c5d6] max-w-xl mx-auto">
            Les applications iPhone (App Store) et Android (Play Store) arrivent
            bientôt. En attendant, Inboria s'installe aussi sur votre téléphone
            via le navigateur, exactement comme sur ordinateur.
          </p>
        </div>
      </section>
    </MarketingLayout>
  );
}
