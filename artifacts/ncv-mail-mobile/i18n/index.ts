import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import nl from "./locales/nl.json";
import de from "./locales/de.json";
import es from "./locales/es.json";
import it from "./locales/it.json";
import pt from "./locales/pt.json";

const LANGUAGE_KEY = "inboria-lang";
const SUPPORTED = ["fr", "en", "nl", "de", "es", "it", "pt"] as const;

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    nl: { translation: nl },
    de: { translation: de },
    es: { translation: es },
    it: { translation: it },
    pt: { translation: pt },
  },
  lng: "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

AsyncStorage.getItem(LANGUAGE_KEY).then((savedLang) => {
  if (savedLang && (SUPPORTED as readonly string[]).includes(savedLang)) {
    i18n.changeLanguage(savedLang);
  }
});

export async function changeLanguage(lang: string): Promise<void> {
  if (!(SUPPORTED as readonly string[]).includes(lang)) return;
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export default i18n;
