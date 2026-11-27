import en from "./locales/en/translation.json";
import fr from "./locales/fr/translation.json";
import enFileManager from "./locales/en/file-manager.json";
import frFileManager from "./locales/fr/file-manager.json";

// Single source of truth for supported languages. To add one: create
// both src/locales/<code>/translation.json and file-manager.json, an entry here,
// and locale settings in the file manager adapter.
// The first entry is the source language and the fallback. Labels are endonyms (not translated).
export const LANGUAGES = [
  { code: "en", label: "English", translation: en, fileManager: enFileManager },
  { code: "fr", label: "Français", translation: fr, fileManager: frFileManager },
];

export const DEFAULT_LANGUAGE = LANGUAGES[0].code;

export const isSupportedLanguage = (code) => LANGUAGES.some((language) => language.code === code);
