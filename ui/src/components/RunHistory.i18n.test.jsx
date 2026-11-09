// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import i18n from "../i18n";

const api = vi.hoisted(() => ({ getHistory: vi.fn(), getInfo: vi.fn() }));
vi.mock("bon_in_a_box_script_service", () => ({
  DefaultApi: class {
    getHistory = api.getHistory;
    getInfo = api.getInfo;
  },
}));

import { LastNRuns } from "./RunHistory";

beforeEach(async () => {
  api.getHistory.mockReset();
  api.getInfo.mockReset();
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

it("updates the empty state without refetching", async () => {
  api.getHistory.mockImplementation((options, callback) => callback(null, null, { body: [] }));
  render(<LastNRuns n={4} />);
  expect(screen.getByText("There are currently no runs to display.")).toBeTruthy();
  await act(() => i18n.changeLanguage("fr"));
  expect(screen.getByText("Il n’y a actuellement aucune exécution à afficher.")).toBeTruthy();
  expect(api.getHistory).toHaveBeenCalledTimes(1);
});

it("updates run controls and date while preserving API-provided content", async () => {
  const run = {
    runId: "example>123",
    type: "pipeline",
    status: "completed",
    startTime: "2025-01-02T03:04:05Z",
  };
  api.getHistory.mockImplementation((options, callback) => callback(null, null, { body: [run] }));
  api.getInfo.mockImplementation((type, path, callback) => callback(null, null, {
    status: 200,
    text: JSON.stringify({ name: "API pipeline name", description: "API description", inputs: {} }),
  }));
  render(<LastNRuns n={4} />);
  expect(screen.getByText("API pipeline name")).toBeTruthy();
  expect(screen.getByText("Status: completed")).toBeTruthy();
  expect(screen.getByText(new Date(run.startTime).toLocaleString("en"))).toBeTruthy();
  await act(() => i18n.changeLanguage("fr"));
  expect(screen.getByText("API pipeline name")).toBeTruthy();
  expect(screen.getByText("État : completed")).toBeTruthy();
  expect(screen.getByText(new Date(run.startTime).toLocaleString("fr"))).toBeTruthy();
  expect(screen.getByRole("button", { name: "Voir dans la visionneuse" })).toBeTruthy();
  expect(api.getHistory).toHaveBeenCalledTimes(1);
});
