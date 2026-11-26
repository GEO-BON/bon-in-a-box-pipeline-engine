// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { en as core } from "@svar-ui/core-locales";
import { en as filemanager } from "@svar-ui/filemanager-locales";
import { en as grid } from "@svar-ui/grid-locales";
import { en as uploader } from "@svar-ui/uploader-locales";
import i18n from "../i18n";
import en from "../locales/en/file-manager.json";
import { fileManagerLocale, svarKeys } from "./fileManagerLocale";
import FileManager from "./FileManager";

vi.mock("@svar-ui/filemanager-data-provider", () => ({
  RestDataProvider: class {
    loadFiles() { return Promise.resolve([]); }
    loadInfo() { return Promise.resolve({}); }
    exec() { return Promise.resolve(); }
  },
}));

beforeEach(async () => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
  await i18n.changeLanguage("en");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SVAR translations", () => {
  it("covers the installed SVAR locale keys and English source strings", () => {
    for (const [group, locale] of Object.entries({
      filemanager: filemanager.filemanager,
      core: core.core,
      uploader: uploader.uploader,
      grid: grid.grid,
    })) {
      for (const [label, source] of Object.entries(locale)) {
        expect(svarKeys[group][label], `${group}: ${label}`).toBeDefined();
        expect(en[group][svarKeys[group][label]], `${group}: ${label}`).toBe(source);
      }
    }
    const words = fileManagerLocale(i18n.getFixedT("en", "fileManager"));
    for (const key of ["monthFull", "monthShort", "dayFull", "dayShort", "am", "pm"]) {
      expect(words.calendar[key], key).toEqual(core.calendar[key]);
    }
    for (const key of ["hours", "minutes", "done", "clear", "today"]) {
      expect(words.calendar[key], key).toBe(core.calendar[key]);
    }
  });

  it("falls back to the English catalog for missing French entries", async () => {
    await i18n.changeLanguage("fr");
    const bundle = i18n.getResourceBundle("fr", "fileManager");
    const original = bundle.filemanager.search;
    delete bundle.filemanager.search;
    try {
      expect(fileManagerLocale(i18n.getFixedT("fr", "fileManager")).filemanager.Search).toBe("Search");
      bundle.filemanager.search = "";
      expect(fileManagerLocale(i18n.getFixedT("fr", "fileManager")).filemanager.Search).toBe("Search");
    } finally {
      bundle.filemanager.search = original;
    }
  });

  it("switches the real file manager without clearing its search", async () => {
    render(<FileManager />);
    const search = await screen.findByPlaceholderText("Search");
    expect(screen.getByText("Add New")).toBeTruthy();
    fireEvent.input(search, { target: { value: "example" } });
    await act(() => i18n.changeLanguage("fr"));
    expect(screen.getByPlaceholderText("Rechercher").value).toBe("example");
    expect(screen.getByText(/Résultats de recherche dans/)).toBeTruthy();
    await act(() => i18n.changeLanguage("en"));
    expect(screen.getByPlaceholderText("Search").value).toBe("example");
    await waitFor(() => expect(screen.getByText(/Search results in/)).toBeTruthy());
  });

  it("translates the add menu and an open folder dialog when the language changes", async () => {
    render(<FileManager />);
    fireEvent.click(await screen.findByText("Add New"));
    fireEvent.click(await screen.findByText("Add new folder"));
    expect(await screen.findByText("Enter folder name")).toBeTruthy();
    expect(screen.getByDisplayValue("New folder")).toBeTruthy();

    await act(() => i18n.changeLanguage("fr"));
    expect(screen.getByText("Saisir le nom du dossier")).toBeTruthy();
    expect(screen.getByText("Annuler")).toBeTruthy();
    expect(screen.getByDisplayValue("New folder")).toBeTruthy();

    fireEvent.click(screen.getByText("Annuler"));
    fireEvent.click(screen.getByText("Ajouter"));
    expect(await screen.findByText("Ajouter un dossier")).toBeTruthy();
  });
});
