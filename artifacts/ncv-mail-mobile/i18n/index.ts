import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import nl from "./locales/nl.json";
import de from "./locales/de.json";
import es from "./locales/es.json";

const LANGUAGE_KEY = "inboria-lang";

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    nl: { translation: nl },
    de: { translation: de },
    es: { translation: es },
  },
  lng: "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
});

AsyncStorage.getItem(LANGUAGE_KEY).then((savedLang) => {
  if (savedLang && ["fr", "en", "nl", "de", "es"].includes(savedLang)) {
    i18n.changeLanguage(savedLang);
  }
});

export const changeLanguage = async (lang: string) => {
  await i18n.changeLanguage(lang);
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
};

export default i18n;
