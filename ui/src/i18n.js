import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LANGUAGE, LANGUAGES, isSupportedLanguage } from "./languages";

export const LANGUAGE_KEY = "biab.ui.language";

export function browserLanguage(languages = navigator.languages?.length ? navigator.languages : [navigator.language]) {
  for (const language of languages) {
    const base = language?.toLowerCase().split("-")[0];
    if (isSupportedLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

export function readPreference() {
  try {
    const value = localStorage.getItem(LANGUAGE_KEY);
    return { preference: isSupportedLanguage(value) ? value : "browser", error: false };
  } catch (error) {
    console.warn("Unable to read the language preference:", error);
    return { preference: "browser", error: true };
  }
}

export function savePreference(preference) {
  try {
    if (preference === "browser") localStorage.removeItem(LANGUAGE_KEY);
    else localStorage.setItem(LANGUAGE_KEY, preference);
    return true;
  } catch (error) {
    console.warn("Unable to save the language preference:", error);
    return false;
  }
}

let currentPreference = readPreference();
const language = currentPreference.preference === "browser" ? browserLanguage() : currentPreference.preference;

export function getPreference() {
  return currentPreference;
}

export function changePreference(preference) {
  const saved = savePreference(preference);
  currentPreference = { preference, error: !saved };
  i18n.changeLanguage(preference === "browser" ? browserLanguage() : preference);
  return currentPreference;
}

i18n.use(initReactI18next).init({
  resources: Object.fromEntries(LANGUAGES.map(({ code, translation }) => [code, { translation }])),
  lng: language,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES.map(({ code }) => code),
  initAsync: false,
  interpolation: { escapeValue: false },
});

function updateDocumentLanguage(lng) {
  document.documentElement.lang = lng;
  document.documentElement.dir = i18n.dir(lng);
}
updateDocumentLanguage(language);
i18n.on("languageChanged", updateDocumentLanguage);
window.addEventListener("languagechange", () => {
  if (currentPreference.preference === "browser") i18n.changeLanguage(browserLanguage());
});

export default i18n;
