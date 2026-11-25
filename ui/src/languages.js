import en from "./locales/en/translation.json";
import fr from "./locales/fr/translation.json";

// Single source of truth for supported languages. To add one: create
// src/locales/<code>/translation.json and an entry here.
// The first entry is the source language and the fallback. Labels are endonyms (not translated).
export const LANGUAGES = [
  { code: "en", label: "English", translation: en },
  { code: "fr", label: "Français", translation: fr },
];

export const DEFAULT_LANGUAGE = LANGUAGES[0].code;

export const isSupportedLanguage = (code) => LANGUAGES.some((language) => language.code === code);
