import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import fr from "./locales/fr.json";
import en from "./locales/en.json";
import nl from "./locales/nl.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";
import pl from "./locales/pl.json";
import ro from "./locales/ro.json";
import sv from "./locales/sv.json";
import da from "./locales/da.json";
import fi from "./locales/fi.json";
import hu from "./locales/hu.json";
import cs from "./locales/cs.json";
import tr from "./locales/tr.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import vi from "./locales/vi.json";
import th from "./locales/th.json";
import id from "./locales/id.json";
import ms from "./locales/ms.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      nl: { translation: nl },
      de: { translation: de },
      es: { translation: es },
      it: { translation: it },
      pt: { translation: pt },
      pl: { translation: pl },
      ro: { translation: ro },
      sv: { translation: sv },
      da: { translation: da },
      fi: { translation: fi },
      hu: { translation: hu },
      cs: { translation: cs },
      tr: { translation: tr },
      ja: { translation: ja },
      ko: { translation: ko },
      vi: { translation: vi },
      th: { translation: th },
      id: { translation: id },
      ms: { translation: ms },
    },
    fallbackLng: "fr",
    supportedLngs: ["fr", "en", "nl", "de", "es", "it", "pt", "pl", "ro", "sv", "da", "fi", "hu", "cs", "tr", "ja", "ko", "vi", "th", "id", "ms"],
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
  });

export default i18n;
