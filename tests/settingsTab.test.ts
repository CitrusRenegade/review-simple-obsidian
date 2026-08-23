import type { App } from "obsidian";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({
  PluginSettingTab: class {
    update = vi.fn();

    constructor(_app: unknown, _plugin: unknown) {}
  },
  Setting: class {},
  normalizePath: (path: string) => path,
}));

import { ReviewSettingTab, type ReviewSettings } from "../src/settings";

type Definition = {
  name?: string;
  aliases?: string[];
  control?: {
    type: string;
    key: string;
    min?: number;
    step?: number | "any";
    validate?: (value: unknown) => string | void;
  };
  items?: Definition[];
};

const settings: ReviewSettings = {
  globalIntervalDays: 45,
  folderFilterMode: "excluded",
  excludedFolders: [],
  includedFolders: [],
  folderIntervals: [],
  showReviewStatus: true,
  showDueCounter: true,
  showRibbonIcon: false,
  frontmatterIntervalKey: "review_interval",
  frontmatterReviewedKey: "reviewed",
};

function flatten(definitions: Definition[]): Definition[] {
  return definitions.flatMap((definition) => [
    definition,
    ...(definition.items ? flatten(definition.items) : []),
  ]);
}

function definitionByName(definitions: Definition[], name: string): Definition {
  const definition = flatten(definitions).find((item) => item.name === name);
  if (!definition) throw new Error(`Missing setting definition: ${name}`);
  return definition;
}

function createTab() {
  const plugin = {
    settings: { ...settings },
    saveSettings: vi.fn(async () => undefined),
    refreshReviewState: vi.fn(),
    updateRibbonIcon: vi.fn(),
  };
  const tab = new ReviewSettingTab({} as App, plugin as never);
  return { plugin, tab };
}

beforeEach(() => {
  vi.stubGlobal("createFragment", (callback: (el: HTMLElement) => void) => {
    const element = {
      appendText: vi.fn(),
      createEl: vi.fn(() => ({ appendText: vi.fn() })),
    };
    callback(element as never);
    return element;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ReviewSettingTab declarative controls", () => {
  it("exposes validated native controls and search aliases for simple settings", () => {
    const { tab } = createTab();
    const definitions = tab.getSettingDefinitions() as Definition[];

    const interval = definitionByName(definitions, "Global review interval");
    expect(interval.aliases).toEqual(expect.arrayContaining(["days", "due", "schedule"]));
    expect(interval.control).toMatchObject({
      type: "number",
      key: "globalIntervalDays",
      min: 1,
      step: 1,
    });
    expect(interval.control?.validate?.(0)).toBe("Enter a whole number of days.");
    expect(interval.control?.validate?.(7)).toBeUndefined();

    const reviewStatus = definitionByName(definitions, "Review status in status bar");
    expect(reviewStatus.aliases).toEqual(expect.arrayContaining(["status", "indicator"]));
    expect(reviewStatus.control).toMatchObject({
      type: "toggle",
      key: "showReviewStatus",
    });
    const dueCounter = definitionByName(definitions, "Due counter in status bar");
    expect(dueCounter.aliases).toEqual(expect.arrayContaining(["due", "pending", "count"]));
    expect(dueCounter.control).toMatchObject({
      type: "toggle",
      key: "showDueCounter",
    });
    const ribbon = definitionByName(definitions, "Ribbon icon");
    expect(ribbon.aliases).toEqual(expect.arrayContaining(["ribbon", "button"]));
    expect(ribbon.control).toMatchObject({
      type: "toggle",
      key: "showRibbonIcon",
    });
    const intervalKey = definitionByName(definitions, "Frontmatter interval key");
    expect(intervalKey.aliases).toEqual(
      expect.arrayContaining(["YAML", "metadata", "review_interval"])
    );
    expect(intervalKey.control).toMatchObject({
      type: "text",
      key: "frontmatterIntervalKey",
    });
    const reviewedKey = definitionByName(definitions, "Frontmatter reviewed key");
    expect(reviewedKey.aliases).toEqual(
      expect.arrayContaining(["YAML", "metadata", "reviewed"])
    );
    expect(reviewedKey.control).toMatchObject({
      type: "text",
      key: "frontmatterReviewedKey",
    });
    expect(definitionByName(definitions, "Excluded / included folders").aliases).toEqual(
      expect.arrayContaining(["mode", "include", "exclude"])
    );
  });

  it("persists declarative control changes and keeps their UI side effects", async () => {
    const { plugin, tab } = createTab();

    await tab.setControlValue("globalIntervalDays", 30);
    expect(plugin.settings.globalIntervalDays).toBe(30);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(plugin.refreshReviewState).toHaveBeenCalledTimes(1);
    expect(plugin.updateRibbonIcon).not.toHaveBeenCalled();

    await tab.setControlValue("showRibbonIcon", true);
    expect(plugin.settings.showRibbonIcon).toBe(true);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(2);
    expect(plugin.updateRibbonIcon).toHaveBeenCalledTimes(1);
  });
});
