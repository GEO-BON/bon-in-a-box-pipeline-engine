// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n, { browserLanguage, changePreference, getPreference, LANGUAGE_KEY, readPreference } from "./i18n";
import LanguageSelector from "./components/LanguageSelector";
import HomePage from "./components/HomePage";
import en from "./locales/en/translation.json";
import fr from "./locales/fr/translation.json";

vi.mock("./components/RunHistory", () => ({
  LastNRuns: () => <div>API content</div>,
}));

beforeEach(() => {
  localStorage.clear();
  changePreference("browser");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const pick = (button, option) => {
  fireEvent.click(screen.getByRole("button", { name: button }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(option) }));
};

describe("language selection", () => {
  it("uses the first supported browser language and falls back to English", () => {
    expect(browserLanguage(["es-MX", "fr-CA", "en-US"])).toBe("fr");
    expect(browserLanguage(["en-GB", "fr"])).toBe("en");
    expect(browserLanguage(["es", "de"])).toBe("en");
  });

  it("switches the home page immediately and saves an explicit choice", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["en-US"]);
    changePreference("browser");
    render(<><LanguageSelector /><HomePage /></>);
    expect(screen.getByText("Biodiversity Evaluation Engine")).toBeTruthy();
    expect(screen.getByRole("link", { name: "GEO BON" }).getAttribute("href")).toBe("https://geobon.org");
    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
    pick("Language", "Français");
    expect(screen.getByText("Moteur d’évaluation de la biodiversité")).toBeTruthy();
    expect(screen.getByRole("link", { name: "GEO BON" }).getAttribute("href")).toBe("https://geobon.org");
    expect(screen.getByText("API content")).toBeTruthy();
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("fr");
    expect(document.documentElement.lang).toBe("fr");
    expect(readPreference().preference).toBe("fr");
    pick("Langue", "English");
    expect(screen.getByText("Biodiversity Evaluation Engine")).toBeTruthy();
    expect(localStorage.getItem(LANGUAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("warns when storage fails while keeping the selection for the session", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    render(<LanguageSelector />);
    pick("Language", "Français");
    expect(screen.getByRole("alert").textContent).toContain("préférence linguistique");
    expect(getPreference()).toEqual({ preference: "fr", error: true });
    cleanup();
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Langue" }));
    expect(screen.getByRole("option", { name: /Français/ }).getAttribute("aria-selected")).toBe("true");
    expect(i18n.resolvedLanguage).toBe("fr");
  });

  it("tracks browser language changes in browser mode even when the menu is closed", () => {
    const languages = vi.spyOn(navigator, "languages", "get").mockReturnValue(["en"]);
    changePreference("browser");
    render(<HomePage />);
    languages.mockReturnValue(["fr-CA"]);
    fireEvent(window, new Event("languagechange"));
    expect(screen.getByText("Moteur d’évaluation de la biodiversité")).toBeTruthy();
    expect(localStorage.getItem(LANGUAGE_KEY)).toBeNull();
    changePreference("en");
    fireEvent(window, new Event("languagechange"));
    expect(i18n.resolvedLanguage).toBe("en");
  });

  it("uses English for a missing French key", async () => {
    i18n.addResource("en", "pilot-test", "testFallback", "English fallback");
    await i18n.changeLanguage("fr");
    expect(i18n.t("testFallback", { ns: "pilot-test" })).toBe("English fallback");
    i18n.removeResourceBundle("en", "pilot-test");
  });
});

describe("pilot catalogs", () => {
  it("keeps English and French keys and interpolation placeholders in sync", () => {
    const flatten = (object, prefix = "") => Object.entries(object).flatMap(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === "string" ? [[path, value]] : flatten(value, path);
    });
    const source = Object.fromEntries(flatten(en));
    const target = Object.fromEntries(flatten(fr));
    expect(Object.keys(target).sort()).toEqual(Object.keys(source).sort());
    for (const key of Object.keys(source)) {
      const placeholders = (value) => [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1]).sort();
      expect(placeholders(target[key]), key).toEqual(placeholders(source[key]));
    }
  });
});
