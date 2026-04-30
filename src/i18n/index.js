import i18n from "i18next";
import Backend from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LANGUAGE,
  getLanguageDirection,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
} from "../constants/languages";

const supportedLanguageCodes = SUPPORTED_LANGUAGES.map(
  (language) => language.code
);

const syncDocumentLanguage = (languageCode) => {
  if (typeof document === "undefined") {
    return;
  }

  const normalizedLanguage = supportedLanguageCodes.includes(languageCode)
    ? languageCode
    : DEFAULT_LANGUAGE;

  document.documentElement.lang = normalizedLanguage;
  document.documentElement.dir = getLanguageDirection(normalizedLanguage);
};

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: supportedLanguageCodes,
    nonExplicitSupportedLngs: true,
    load: "languageOnly",
    ns: ["common"],
    defaultNS: "common",
    debug: false,
    returnNull: false,
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: "/locales/{{lng}}/common.json",
    },
    detection: {
      order: ["querystring", "localStorage", "navigator", "htmlTag"],
      caches: ["localStorage"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
    react: {
      useSuspense: false,
    },
  });

syncDocumentLanguage(i18n.resolvedLanguage || i18n.language);
i18n.on("languageChanged", syncDocumentLanguage);

export default i18n;
