export const LANGUAGE_STORAGE_KEY = "konn3ct-language";

export const SUPPORTED_LANGUAGES = [
  {
    code: "en",
    name: "English",
    dir: "ltr",
  },
];

export const DEFAULT_LANGUAGE = SUPPORTED_LANGUAGES[0].code;

export const RTL_LANGUAGES = SUPPORTED_LANGUAGES
  .filter((language) => language.dir === "rtl")
  .map((language) => language.code);

export const getLanguageDirection = (languageCode) =>
  RTL_LANGUAGES.includes(languageCode) ? "rtl" : "ltr";
