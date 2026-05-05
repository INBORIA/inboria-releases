import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { useUpdateProfile } from "@workspace/api-client-react";

const languages = [
  { code: "fr", label: "FR", name: "Français" },
  { code: "en", label: "EN", name: "English" },
  { code: "nl", label: "NL", name: "Nederlands" },
  { code: "de", label: "DE", name: "Deutsch" },
  { code: "es", label: "ES", name: "Español" },
  { code: "it", label: "IT", name: "Italiano" },
  { code: "pt", label: "PT", name: "Português" },
  { code: "pl", label: "PL", name: "Polski" },
  { code: "ro", label: "RO", name: "Română" },
  { code: "sv", label: "SV", name: "Svenska" },
  { code: "da", label: "DA", name: "Dansk" },
  { code: "fi", label: "FI", name: "Suomi" },
  { code: "hu", label: "HU", name: "Magyar" },
  { code: "cs", label: "CS", name: "Čeština" },
  { code: "tr", label: "TR", name: "Türkçe" },
  { code: "ja", label: "JA", name: "日本語" },
  { code: "ko", label: "KO", name: "한국어" },
  { code: "vi", label: "VI", name: "Tiếng Việt" },
  { code: "th", label: "TH", name: "ไทย" },
  { code: "id", label: "ID", name: "Bahasa Indonesia" },
  { code: "ms", label: "MS", name: "Bahasa Melayu" },
  { code: "el", label: "EL", name: "Ελληνικά" },
  { code: "uk", label: "UK", name: "Українська" },
  { code: "et", label: "ET", name: "Eesti" },
  { code: "zh", label: "ZH", name: "简体中文" },
  { code: "zh-TW", label: "ZH-TW", name: "繁體中文" },
  { code: "lt", label: "LT", name: "Lietuvių" },
  { code: "sr", label: "SR", name: "Српски" },
];

export function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "compact" }) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const rawLang = (i18n.resolvedLanguage || i18n.language || "fr");
  const lowerFull = rawLang.toLowerCase();
  const normalized = (lowerFull === "zh-tw" || lowerFull === "zh_tw" || lowerFull === "zh-hant" || lowerFull === "zh-hk") ? "zh-TW" : rawLang.slice(0, 2).toLowerCase();
  const activeCode = normalized;
  const currentLang = languages.find((l) => l.code === activeCode) || languages[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg transition-colors ${
          variant === "compact"
            ? "px-2 py-1.5 text-[11px] text-[#b8c5d6] hover:text-white hover:bg-white/[0.06]"
            : "px-3 py-2 text-[13px] text-[#b8c5d6] hover:text-white border border-transparent hover:border-[#1f2937]"
        }`}
      >
        <Globe className={variant === "compact" ? "w-3.5 h-3.5" : "w-4 h-4"} />
        <span className="font-medium">{currentLang.label}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 rounded-lg border border-[#1f2937] bg-[#141c2b] shadow-xl z-50 max-h-80 overflow-y-auto overscroll-contain">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                i18n.changeLanguage(lang.code);
                if (user) {
                  updateProfile.mutate(
                    { data: { aiLanguage: lang.code as any } },
                    { onError: () => {} },
                  );
                }
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] transition-colors ${
                activeCode === lang.code
                  ? "bg-[#2d7dd2]/10 text-[#2d7dd2]"
                  : "text-[#b8c5d6] hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <span className="font-medium w-7 shrink-0">{lang.label}</span>
              <span className="text-[12px] opacity-70 whitespace-nowrap">{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
