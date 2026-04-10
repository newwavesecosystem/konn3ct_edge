import i18n from "i18next";
import Backend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_NAMESPACE,
  FALLBACK_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
} from "../constants/languages";

const APP_LANGUAGE = FALLBACK_LANGUAGE;
const APP_TEXT_DIRECTION = "ltr";

const clearStoredLanguagePreference = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  } catch (error) {
    // Ignore storage cleanup failures and keep app bootstrap resilient.
  }
};

const updateDocumentLanguage = () => {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = APP_LANGUAGE;
  document.documentElement.dir = APP_TEXT_DIRECTION;
};

if (!i18n.isInitialized) {
  clearStoredLanguagePreference();

  i18n
    .use(Backend)
    .use(initReactI18next)
    .init({
      supportedLngs: [APP_LANGUAGE],
      lng: APP_LANGUAGE,
      fallbackLng: APP_LANGUAGE,
      load: "languageOnly",
      defaultNS: DEFAULT_NAMESPACE,
      ns: [DEFAULT_NAMESPACE],
      backend: {
        loadPath: `${process.env.PUBLIC_URL || ""}/locales/{{lng}}/{{ns}}.json`,
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

i18n.on("languageChanged", () => {
  updateDocumentLanguage();
});

updateDocumentLanguage();

export default i18n;
