import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Seul le français (langue de repli / fallbackLng) est embarqué au démarrage.
// Les 42 autres langues sont chargées À LA DEMANDE (un chunk par langue généré
// par Vite via import.meta.glob) : la 1ʳᵉ ouverture ne télécharge plus ~9 Mo de
// traductions inutiles mais seulement le français + la langue réellement active.
import fr from "./locales/fr.json";

export const SUPPORTED_LNGS = [
  "fr", "en", "nl", "de", "es", "it", "pt", "pl", "ro", "sv", "da", "fi",
  "hu", "cs", "tr", "ja", "ko", "vi", "th", "id", "ms", "el", "uk", "et",
  "zh", "zh-TW", "lt", "sr", "ru", "he", "ar", "hr", "sk", "sl", "lv", "mt",
  "bg", "nb", "ca", "ga", "ur", "hi", "km",
] as const;

// Un loader paresseux par fichier de langue (Vite crée un chunk séparé pour
// chacun). `{ import: "default" }` => le loader renvoie directement l'objet JSON.
const localeLoaders = import.meta.glob("./locales/*.json", {
  import: "default",
}) as Record<string, () => Promise<Record<string, unknown>>>;

const loaded = new Set<string>(["fr"]);
const inflight = new Map<string, Promise<void>>();

function normalizeCode(lng: string): string {
  if (!lng) return "fr";
  // i18next peut renvoyer « en-US » ; on ne garde que la base SAUF le chinois
  // traditionnel (seule variante régionale distincte de nos fichiers). On couvre
  // tous les alias « traditionnel » comme le fait LanguageSwitcher pour que le
  // bon fichier (zh-TW.json, Traditionnel) soit chargé et jamais zh.json (Simplifié).
  const lower = lng.toLowerCase();
  if (
    lower === "zh-tw" ||
    lower === "zh_tw" ||
    lower === "zh-hant" ||
    lower === "zh-hk"
  ) {
    return "zh-TW";
  }
  return lng.split("-")[0];
}

// Charge (une seule fois) le bundle d'une langue et l'enregistre dans i18next.
// Idempotent et anti-doublon (Map inflight) ; silencieux en cas d'échec réseau
// (on garde le repli français plutôt que de planter l'UI).
export async function ensureLanguageLoaded(lng: string): Promise<void> {
  const code = normalizeCode(lng);
  if (loaded.has(code)) return;
  const existing = inflight.get(code);
  if (existing) return existing;

  const loader = localeLoaders[`./locales/${code}.json`];
  if (!loader) return;

  const p = loader()
    .then((data) => {
      i18n.addResourceBundle(code, "translation", data, true, true);
      loaded.add(code);
    })
    .catch(() => {
      /* repli français conservé */
    })
    .finally(() => {
      inflight.delete(code);
    });
  inflight.set(code, p);
  return p;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
    },
    fallbackLng: "fr",
    supportedLngs: [...SUPPORTED_LNGS],
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "inboria-lang",
      caches: ["localStorage"],
    },
    react: {
      // Pas de Suspense : les langues arrivent en asynchrone, on rend
      // immédiatement avec le repli français puis on re-rend dès que le
      // bundle de la langue active est ajouté (« added »).
      useSuspense: false,
      bindI18nStore: "added",
    },
  });

// Langues à écriture droite-à-gauche (arabe, hébreu, ourdou). On applique
// dynamiquement `dir="rtl"` sur <html> pour que toute l'UI (barre latérale,
// listes, alignements, classes Tailwind `rtl:`) bascule correctement.
const RTL_LNGS = new Set(["ar", "he", "ur"]);

function applyDocumentDirection(lng: string): void {
  if (typeof document === "undefined") return;
  const code = normalizeCode(lng);
  const dir = RTL_LNGS.has(code) ? "rtl" : "ltr";
  document.documentElement.setAttribute("dir", dir);
  document.documentElement.setAttribute("lang", code);
}

// Charge la langue détectée au boot (si ≠ fr) puis toute langue choisie ensuite.
i18n.on("languageChanged", (lng) => {
  void ensureLanguageLoaded(lng);
  applyDocumentDirection(lng);
});
// Au boot, on lit d'abord la préférence stockée brute (clé « inboria-lang ») :
// elle conserve le code complet « zh-TW » alors que i18n.resolvedLanguage peut
// l'écraser en « zh » (à cause de load:"languageOnly") → mauvais fichier chargé.
let bootLng = i18n.language || i18n.resolvedLanguage || "fr";
try {
  if (typeof localStorage !== "undefined") {
    bootLng = localStorage.getItem("inboria-lang") || bootLng;
  }
} catch {
  /* localStorage indisponible (mode privé) → on garde la langue i18next */
}
void ensureLanguageLoaded(bootLng);
applyDocumentDirection(bootLng);

export default i18n;
