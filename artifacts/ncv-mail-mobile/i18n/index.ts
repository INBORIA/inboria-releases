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
import el from "./locales/el.json";
import uk from "./locales/uk.json";
import et from "./locales/et.json";
import zh from "./locales/zh.json";
import zhTw from "./locales/zh-TW.json";
import lt from "./locales/lt.json";
import sr from "./locales/sr.json";
import ru from "./locales/ru.json";
import he from "./locales/he.json";
import ar from "./locales/ar.json";

const LANGUAGE_KEY = "inboria-lang";
const SUPPORTED = ["fr", "en", "nl", "de", "es", "it", "pt", "pl", "ro", "sv", "da", "fi", "hu", "cs", "tr", "ja", "ko", "vi", "th", "id", "ms", "el", "uk", "et", "zh", "zh-TW", "lt", "sr", "ru", "he", "ar"] as const;

i18n.use(initReactI18next).init({
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
    el: { translation: el },
    uk: { translation: uk },
    et: { translation: et },
    zh: { translation: zh },
    "zh-TW": { translation: zhTw },
    lt: { translation: lt },
    sr: { translation: sr },
    ru: { translation: ru },
    he: { translation: he },
    ar: { translation: ar },
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
