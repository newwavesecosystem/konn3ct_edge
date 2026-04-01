export const LANGUAGE_STORAGE_KEY = "konn3ct-language";
export const DEFAULT_NAMESPACE = "common";
export const FALLBACK_LANGUAGE = "en";

export const RTL_LANGUAGES = ["ar"];

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "fr", label: "French", nativeLabel: "Français" },
  { code: "es", label: "Spanish", nativeLabel: "Español" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية" },
  { code: "pt", label: "Portuguese", nativeLabel: "Português" },
];

export const SUPPORTED_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map(
  ({ code }) => code
);

export const getNormalizedLanguage = (language = FALLBACK_LANGUAGE) =>
  String(language || FALLBACK_LANGUAGE).split("-")[0].toLowerCase();

export const getLanguageDirection = (language = FALLBACK_LANGUAGE) =>
  RTL_LANGUAGES.includes(getNormalizedLanguage(language)) ? "rtl" : "ltr";

export const getLanguageOption = (language = FALLBACK_LANGUAGE) =>
  SUPPORTED_LANGUAGES.find(
    ({ code }) => code === getNormalizedLanguage(language)
  ) ?? SUPPORTED_LANGUAGES[0];
