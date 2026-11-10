// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import i18n, { browserLanguage, changePreference, getPreference, LANGUAGE_KEY, readPreference } from "./i18n";
import LanguageSelector from "./components/LanguageSelector";
import HomePage from "./components/HomePage";
import InputType, { inputTypeToDisplay } from "./components/form/InputType";
import { formatError } from "./components/HttpErrors";
import { GeneralDescription } from "./components/StepDescription";
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

describe("translation catalogs", () => {
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

describe("translated UI", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  describe("compute description", () => {
    it("adds the HPC sentence only when enabled and updates it with the language", async () => {
      const compute = { "cpus-per-task": 1, mem: "8G", time: "2h" };
      const { rerender } = render(<GeneralDescription metadata={{ compute }} />);
      const englishCompute = "Compute: Uses 1 core capped to 8G of memory.";
      const englishHpc = "This script can run on a HPC, with a maximum duration of 2h.";
      expect(screen.getByText(englishCompute)).toBeTruthy();
      expect(screen.queryByTitle(`${englishCompute} ${englishHpc}`)).toBeNull();

      rerender(<GeneralDescription metadata={{ compute: { ...compute, hpc: true } }} />);
      expect(screen.getByText(`${englishCompute} ${englishHpc}`)).toBeTruthy();
      expect(screen.getByTitle(`${englishCompute} ${englishHpc}`)).toBeTruthy();

      await act(() => i18n.changeLanguage("fr"));
      const frenchCompute = "Calcul\u00a0: utilise 1 cœur, limité à 8G de mémoire.";
      const frenchHpc = "Ce script peut s’exécuter sur un HPC, pour une durée maximale de 2h.";
      expect(screen.getByText("HPC").closest("[title]").getAttribute("title"))
        .toBe(`${frenchCompute} ${frenchHpc}`);
      expect(screen.getByText(/Ce script peut s’exécuter sur un HPC/).textContent)
        .toBe(`${frenchCompute} ${frenchHpc}`);

      rerender(<GeneralDescription metadata={{ compute: { ...compute, "cpus-per-task": 4, hpc: true } }} />);
      expect(screen.getByText("HPC").closest("[title]").getAttribute("title"))
        .toBe(`Calcul\u00a0: utilise 4 cœurs, limités à 8G de mémoire. ${frenchHpc}`);
    });
  });

  it("keeps the English input type output", () => {
    const t = (key, opts) => i18n.t(key, opts);
    expect(inputTypeToDisplay("boolean", t)).toBeNull();
    expect(inputTypeToDisplay("COUNTRY", t)).toBeNull();
    expect(inputTypeToDisplay("int[]", t)).toBe("comma-separated list of integers");
    expect(inputTypeToDisplay("text", t)).toBe("text");
    expect(inputTypeToDisplay("text[]", t)).toBe("comma-separated list of texts");
    expect(inputTypeToDisplay("text/plain", t)).toBe("path to text file");
    expect(inputTypeToDisplay("text/plain[]", t)).toBe("comma-separated list of paths to text files");
    expect(inputTypeToDisplay("custom", t)).toBe("custom");
    expect(inputTypeToDisplay("custom[]", t)).toBe("comma-separated list of customs");
    expect(inputTypeToDisplay("text/csv", t)).toBe("path to comma separated values file");
    expect(inputTypeToDisplay("text/csv[]", t)).toBe(
      "comma-separated list of paths to comma separated values files",
    );
    expect(inputTypeToDisplay("application/x-xpath", t)).toBe("path to application/x-xpath file");
    expect(inputTypeToDisplay("application/x-xpath[]", t)).toBe(
      "comma-separated list of paths to application/x-xpath files",
    );
    expect(inputTypeToDisplay("custom/file[]", t)).toBe("comma-separated list of paths to custom/file files");
    expect(inputTypeToDisplay("options[]", t)).toBe("multiple options");
  });

  it("translates input types to French", async () => {
    const t = (key, opts) => i18n.t(key, opts);
    await i18n.changeLanguage("fr");
    expect(inputTypeToDisplay("float[]", t)).toBe(
      "liste séparée par des virgules de nombres décimaux",
    );
    expect(inputTypeToDisplay("int", t)).toBe("nombre entier");
    expect(inputTypeToDisplay("text", t)).toBe("texte");
    expect(inputTypeToDisplay("text[]", t)).toBe("liste séparée par des virgules de textes");
    expect(inputTypeToDisplay("text/plain", t)).toBe("chemin vers un fichier texte");
    expect(inputTypeToDisplay("text/plain[]", t)).toBe("liste séparée par des virgules de chemins vers des fichiers texte");
    expect(inputTypeToDisplay("text/csv", t)).toBe("chemin vers un fichier de valeurs séparées par des virgules");
    expect(inputTypeToDisplay("text/csv[]", t)).toBe(
      "liste séparée par des virgules de chemins vers des fichiers de valeurs séparées par des virgules",
    );
    expect(inputTypeToDisplay("custom[]", t)).toBe("liste séparée par des virgules de custom");
    expect(inputTypeToDisplay("application/x-xpath", t)).toBe("chemin vers un fichier application/x-xpath");
    expect(inputTypeToDisplay("application/x-xpath[]", t)).toBe(
      "liste séparée par des virgules de chemins vers des fichiers application/x-xpath",
    );
  });

  it("updates a text array label when the language changes", async () => {
    render(<InputType type="text[]" />);
    expect(screen.getByText("comma-separated list of texts")).toBeTruthy();
    await act(() => i18n.changeLanguage("fr"));
    expect(screen.getByText("liste séparée par des virgules de textes")).toBeTruthy();
  });

  it("formats error messages before their details", async () => {
    expect(formatError(null, { status: 500, statusText: "Oops" }, "Failed")).toMatch(/^Failed: /);
    await i18n.changeLanguage("fr");
    expect(formatError(null, { status: 500, statusText: "Oops" }, "Échec")).toMatch(
      /^Échec\u00a0: /,
    );
  });

  it("selects translated plural forms", async () => {
    expect(i18n.t("fileBrowser.useSelected", { count: 1 })).toBe("Use selected file");
    expect(i18n.t("fileBrowser.useSelected", { count: 2 })).toBe("Use selected files");
    await i18n.changeLanguage("fr");
    expect(i18n.t("fileBrowser.useSelected", { count: 0 })).toBe("Utiliser la sélection");
    expect(i18n.t("description.compute", { count: 4, mem: "8G" })).toContain("4 cœurs");
  });
});
