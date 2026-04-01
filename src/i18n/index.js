import i18n from "i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_NAMESPACE,
  FALLBACK_LANGUAGE,
  getLanguageDirection,
  getNormalizedLanguage,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGE_CODES,
} from "../constants/languages";

const updateDocumentLanguage = (language) => {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedLanguage = getNormalizedLanguage(language);

  document.documentElement.lang = normalizedLanguage;
  document.documentElement.dir = getLanguageDirection(normalizedLanguage);
};

if (!i18n.isInitialized) {
  i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      supportedLngs: SUPPORTED_LANGUAGE_CODES,
      fallbackLng: FALLBACK_LANGUAGE,
      load: "languageOnly",
      defaultNS: DEFAULT_NAMESPACE,
      ns: [DEFAULT_NAMESPACE],
      backend: {
        loadPath: `${process.env.PUBLIC_URL || ""}/locales/{{lng}}/{{ns}}.json`,
      },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: LANGUAGE_STORAGE_KEY,
        caches: ["localStorage"],
      },
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
      returnNull: false,
    });
}

i18n.on("languageChanged", (language) => {
  updateDocumentLanguage(language);
});

updateDocumentLanguage(i18n.resolvedLanguage || i18n.language);

export default i18n;
