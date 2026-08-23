import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { parsePositiveDayCount } from "./interval";
import { normalizeFolderReviewRules } from "./folderRules";
import { isValidFrontmatterKey } from "./frontmatterKey";
import type ReviewPlugin from "./main";

export interface FolderInterval {
  folder: string;
  days: number;
}

export type FolderFilterMode = "excluded" | "included";

export interface ReviewSettings {
  globalIntervalDays: number;
  folderFilterMode: FolderFilterMode;
  excludedFolders: string[];
  includedFolders: string[];
  folderIntervals: FolderInterval[];
  showReviewStatus: boolean;
  showDueCounter: boolean;
  showRibbonIcon: boolean;
  frontmatterIntervalKey: string;
  frontmatterReviewedKey: string;
}

export const DEFAULT_SETTINGS: ReviewSettings = {
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

interface ReviewSettingDefinition {
  label: string;
  description?: string | DocumentFragment;
  render: (setting: Setting) => void;
}

interface ReviewSettingSection {
  heading?: string;
  items: ReviewSettingDefinition[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asPositiveDayCount(value: unknown, fallback: number): number {
  return parsePositiveDayCount(value) ?? fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function asFrontmatterKey(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return isValidFrontmatterKey(trimmed) ? trimmed : fallback;
}

function asFolderFilterMode(value: unknown): FolderFilterMode {
  return value === "included" || value === "excluded"
    ? value
    : DEFAULT_SETTINGS.folderFilterMode;
}

function asPathList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => normalizePath(item));
}

function asFolderIntervals(value: unknown): FolderInterval[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const folder = asNonEmptyString(item.folder, "");
    const days = parsePositiveDayCount(item.days);
    if (!folder || days === null) return [];
    return [{ folder: normalizePath(folder), days }];
  });
}

export function loadReviewSettings(data: unknown): ReviewSettings {
  const raw = isRecord(data) ? data : {};
  const settings = {
    globalIntervalDays: asPositiveDayCount(
      raw.globalIntervalDays,
      DEFAULT_SETTINGS.globalIntervalDays
    ),
    folderFilterMode: asFolderFilterMode(raw.folderFilterMode),
    excludedFolders: asPathList(raw.excludedFolders),
    includedFolders: asPathList(raw.includedFolders),
    folderIntervals: asFolderIntervals(raw.folderIntervals),
    showReviewStatus: asBoolean(
      raw.showReviewStatus,
      DEFAULT_SETTINGS.showReviewStatus
    ),
    showDueCounter: asBoolean(
      raw.showDueCounter,
      DEFAULT_SETTINGS.showDueCounter
    ),
    showRibbonIcon: asBoolean(
      raw.showRibbonIcon,
      DEFAULT_SETTINGS.showRibbonIcon
    ),
    frontmatterIntervalKey: asFrontmatterKey(
      raw.frontmatterIntervalKey,
      DEFAULT_SETTINGS.frontmatterIntervalKey
    ),
    frontmatterReviewedKey: asFrontmatterKey(
      raw.frontmatterReviewedKey,
      DEFAULT_SETTINGS.frontmatterReviewedKey
    ),
  };
  normalizeFolderReviewRules(settings);
  return settings;
}

export class ReviewSettingTab extends PluginSettingTab {
  plugin: ReviewPlugin;
  private refreshTimeout: number | null = null;
  private saveTimeout: number | null = null;

  constructor(app: App, plugin: ReviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private refreshReviewState(): void {
    if (this.refreshTimeout !== null) {
      window.clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    this.plugin.refreshReviewState();
  }

  private scheduleReviewStateRefresh(): void {
    if (this.refreshTimeout !== null) {
      window.clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = window.setTimeout(() => {
      this.refreshTimeout = null;
      this.plugin.refreshReviewState();
    }, 500);
  }

  private async saveSettingsNow(): Promise<void> {
    try {
      await this.plugin.saveSettings();
    } catch (e) {
      console.error("Failed to save review settings:", e);
    }
  }

  private scheduleSettingsSave(): void {
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.saveTimeout = null;
      void this.saveSettingsNow();
    }, 500);
  }

  dispose(): void {
    if (this.refreshTimeout !== null) {
      window.clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    if (this.saveTimeout !== null) {
      window.clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
      void this.saveSettingsNow();
    }
  }

  refresh(): void {
    const runtimeTab = this as unknown as { update?: () => void };
    if (runtimeTab.update) {
      runtimeTab.update.call(this);
      return;
    }
    this.renderLegacySettings();
  }

  display(): void {
    this.renderLegacySettings();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const definitions: SettingDefinitionItem[] = [];
    for (const section of this.getSettingSections()) {
      if (section.heading) {
        definitions.push({
          type: "group",
          heading: section.heading,
          items: section.items.map((item) => ({
            name: item.label,
            desc: item.description,
            render: item.render,
          })),
        });
      } else {
        definitions.push(
          ...section.items.map((item) => ({
            name: item.label,
            desc: item.description,
            render: item.render,
          }))
        );
      }
    }
    return definitions;
  }

  private renderLegacySettings(): void {
    const { containerEl } = this;
    containerEl.empty();

    for (const section of this.getSettingSections()) {
      if (section.heading) {
        new Setting(containerEl).setName(section.heading).setHeading();
      }
      for (const definition of section.items) {
        const setting = new Setting(containerEl).setName(definition.label);
        if (definition.description) setting.setDesc(definition.description);
        definition.render(setting);
      }
    }
  }

  private getSettingSections(): ReviewSettingSection[] {
    const isIncluded = this.plugin.settings.folderFilterMode === "included";

    return [
      {
        items: [
          {
            label: "Global review interval",
            description:
              "Default number of days for reviewed notes without a per-note or folder interval.",
            render: (setting) => {
              setting.addText((text) =>
                text
                  .setPlaceholder("45")
                  .setValue(String(this.plugin.settings.globalIntervalDays))
                  .onChange(async (value) => {
                    const n = parsePositiveDayCount(value);
                    if (n !== null) {
                      this.plugin.settings.globalIntervalDays = n;
                      await this.plugin.saveSettings();
                      this.refreshReviewState();
                    }
                  })
              );
            },
          },
          {
            label: "Excluded / included folders",
            description: createFragment((el) => {
              el.appendText("OFF — listed folders are excluded by default.");
              el.createEl("br");
              el.appendText(
                "ON — only listed folders are reviewed by default. Per-note intervals can still include individual notes."
              );
            }),
            render: (setting) => {
              setting.addToggle((toggle) =>
                toggle
                  .setValue(this.plugin.settings.folderFilterMode === "included")
                  .onChange(async (value) => {
                    this.plugin.settings.folderFilterMode = value
                      ? "included"
                      : "excluded";
                    await this.plugin.saveSettings();
                    this.refreshReviewState();
                    this.refresh();
                  })
              );
            },
          },
          {
            label: isIncluded
              ? "Global included folders"
              : "Global excluded folders",
            description:
              "One path per line, relative to vault root. Per-note intervals override this list.",
            render: (setting) => {
              setting.addTextArea((text) => {
                const currentList = isIncluded
                  ? this.plugin.settings.includedFolders
                  : this.plugin.settings.excludedFolders;
                text
                  .setPlaceholder(
                    isIncluded
                      ? "Notes\nJournal"
                      : "Templates\nAttachments\nArchive"
                  )
                  .setValue(currentList.join("\n"))
                  .onChange((value) => {
                    const parsed = value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((s) => normalizePath(s));
                    if (isIncluded) {
                      this.plugin.settings.includedFolders = parsed;
                    } else {
                      this.plugin.settings.excludedFolders = parsed;
                    }
                    normalizeFolderReviewRules(this.plugin.settings);
                    this.scheduleSettingsSave();
                    this.scheduleReviewStateRefresh();
                  });
                text.inputEl.rows = 5;
                text.inputEl.addClass("review-settings-textarea");
              });
            },
          },
          {
            label: "Folder-specific intervals",
            description:
              'Custom review intervals per folder. Format: "folder/path,days" — one rule per line. ' +
              "Uses longest matching path when rules overlap. Example: Daily Notes,90",
            render: (setting) => {
              setting.addTextArea((text) => {
                text
                  .setPlaceholder("Notes,90\nprojects/portfolio,30")
                  .setValue(
                    this.plugin.settings.folderIntervals
                      .map((r) => `${r.folder},${r.days}`)
                      .join("\n")
                  )
                  .onChange((value) => {
                    this.plugin.settings.folderIntervals = value
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .flatMap((line) => {
                        const idx = line.lastIndexOf(",");
                        if (idx < 1) return [];
                        const folder = line.slice(0, idx).trim();
                        const days = parsePositiveDayCount(line.slice(idx + 1));
                        if (!folder || days === null) return [];
                        return [{ folder: normalizePath(folder), days }];
                      });
                    normalizeFolderReviewRules(this.plugin.settings);
                    this.scheduleSettingsSave();
                    this.scheduleReviewStateRefresh();
                  });
                text.inputEl.rows = 5;
                text.inputEl.addClass("review-settings-textarea");
              });
            },
          },
        ],
      },
      {
        heading: "UI",
        items: [
          {
            label: "Review status in status bar",
            description:
              "Shows per-file review indicator (last review date / due / not reviewed) for the active note.",
            render: (setting) => {
              setting.addToggle((toggle) =>
                toggle
                  .setValue(this.plugin.settings.showReviewStatus)
                  .onChange(async (value) => {
                    this.plugin.settings.showReviewStatus = value;
                    await this.plugin.saveSettings();
                    this.refreshReviewState();
                  })
              );
            },
          },
          {
            label: "Due counter in status bar",
            description:
              "Shows total count of notes due for review across vault, next to the current-note indicator.",
            render: (setting) => {
              setting.addToggle((toggle) =>
                toggle
                  .setValue(this.plugin.settings.showDueCounter)
                  .onChange(async (value) => {
                    this.plugin.settings.showDueCounter = value;
                    await this.plugin.saveSettings();
                    this.refreshReviewState();
                  })
              );
            },
          },
          {
            label: "Ribbon icon",
            description:
              "Adds a left ribbon button that opens a random note due for review.",
            render: (setting) => {
              setting.addToggle((toggle) =>
                toggle
                  .setValue(this.plugin.settings.showRibbonIcon)
                  .onChange(async (value) => {
                    this.plugin.settings.showRibbonIcon = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateRibbonIcon();
                  })
              );
            },
          },
        ],
      },
      {
        heading: "Advanced",
        items: [
          {
            label: "Frontmatter interval key",
            description:
              'Frontmatter field for per-note interval override. Set to a number (days) to include the note, or "never" to exclude it.',
            render: (setting) => {
              setting.addText((text) =>
                text
                  .setValue(this.plugin.settings.frontmatterIntervalKey)
                  .onChange(async (value) => {
                    const v = value.trim();
                    if (isValidFrontmatterKey(v)) {
                      this.plugin.settings.frontmatterIntervalKey = v;
                      await this.plugin.saveSettings();
                      this.refreshReviewState();
                    }
                  })
              );
            },
          },
          {
            label: "Frontmatter reviewed key",
            description:
              "Frontmatter field where the last review date is stored.",
            render: (setting) => {
              setting.addText((text) =>
                text
                  .setValue(this.plugin.settings.frontmatterReviewedKey)
                  .onChange(async (value) => {
                    const v = value.trim();
                    if (isValidFrontmatterKey(v)) {
                      this.plugin.settings.frontmatterReviewedKey = v;
                      await this.plugin.saveSettings();
                      this.refreshReviewState();
                    }
                  })
              );
            },
          },
        ],
      },
    ];
  }
}
