import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "../lib/auth";
import { useUpdateProfile } from "@workspace/api-client-react";

const languages = [
  { code: "fr", label: "FR", flag: "🇫🇷" },
  { code: "en", label: "EN", flag: "🇬🇧" },
  { code: "nl", label: "NL", flag: "🇧🇪" },
  { code: "de", label: "DE", flag: "🇩🇪" },
  { code: "es", label: "ES", flag: "🇪🇸" },
  { code: "it", label: "IT", flag: "🇮🇹" },
  { code: "pt", label: "PT", flag: "🇵🇹" },
  { code: "pl", label: "PL", flag: "🇵🇱" },
  { code: "ro", label: "RO", flag: "🇷🇴" },
  { code: "sv", label: "SV", flag: "🇸🇪" },
  { code: "da", label: "DA", flag: "🇩🇰" },
  { code: "fi", label: "FI", flag: "🇫🇮" },
  { code: "hu", label: "HU", flag: "🇭🇺" },
  { code: "cs", label: "CS", flag: "🇨🇿" },
  { code: "tr", label: "TR", flag: "🇹🇷" },
  { code: "ja", label: "JA", flag: "🇯🇵" },
  { code: "ko", label: "KO", flag: "🇰🇷" },
  { code: "vi", label: "VI", flag: "🇻🇳" },
  { code: "th", label: "TH", flag: "🇹🇭" },
];

const nativeNames: Record<string, string> = {
  fr: "Français",
  en: "English",
  nl: "Nederlands",
  de: "Deutsch",
  es: "Español",
  it: "Italiano",
  pt: "Português",
  pl: "Polski",
  ro: "Română",
  sv: "Svenska",
  da: "Dansk",
  fi: "Suomi",
  hu: "Magyar",
  cs: "Čeština",
  tr: "Türkçe",
  ja: "日本語",
  ko: "한국어",
  vi: "Tiếng Việt",
  th: "ไทย",
};

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

  const activeCode = (i18n.resolvedLanguage || i18n.language || "fr").slice(0, 2).toLowerCase();
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
        <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-[#1f2937] bg-[#141c2b] shadow-xl z-50 overflow-hidden">
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
              <span className="text-base">{lang.flag}</span>
              <span className="font-medium">{lang.label}</span>
              <span className="text-[11px] opacity-60">
                {nativeNames[lang.code] ?? lang.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
