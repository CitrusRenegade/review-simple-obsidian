import { App, PluginSettingTab, Setting, normalizePath } from "obsidian";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asPositiveNumber(value: unknown, fallback: number): number {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? parseFloat(value)
      : NaN;
  return !isNaN(n) && n > 0 ? n : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
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
    const days = asPositiveNumber(item.days, NaN);
    if (!folder || isNaN(days)) return [];
    return [{ folder: normalizePath(folder), days }];
  });
}

export function loadReviewSettings(data: unknown): ReviewSettings {
  const raw = isRecord(data) ? data : {};
  return {
    globalIntervalDays: asPositiveNumber(
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
    frontmatterIntervalKey: asNonEmptyString(
      raw.frontmatterIntervalKey,
      DEFAULT_SETTINGS.frontmatterIntervalKey
    ),
    frontmatterReviewedKey: asNonEmptyString(
      raw.frontmatterReviewedKey,
      DEFAULT_SETTINGS.frontmatterReviewedKey
    ),
  };
}

export class ReviewSettingTab extends PluginSettingTab {
  plugin: ReviewPlugin;
  private refreshTimeout: number | null = null;

  constructor(app: App, plugin: ReviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private refreshReviewState(): void {
    if (this.refreshTimeout !== null) {
      activeWindow.clearTimeout(this.refreshTimeout);
      this.refreshTimeout = null;
    }
    this.plugin.updateAll();
  }

  private scheduleReviewStateRefresh(): void {
    if (this.refreshTimeout !== null) {
      activeWindow.clearTimeout(this.refreshTimeout);
    }
    this.refreshTimeout = activeWindow.setTimeout(() => {
      this.refreshTimeout = null;
      this.plugin.updateAll();
    }, 500);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Global review interval")
      .setDesc("Default number of days between reviews for all notes.")
      .addText((text) =>
        text
          .setPlaceholder("45")
          .setValue(String(this.plugin.settings.globalIntervalDays))
          .onChange(async (value) => {
            const n = parseInt(value);
            if (!isNaN(n) && n > 0) {
              this.plugin.settings.globalIntervalDays = n;
              await this.plugin.saveSettings();
              this.refreshReviewState();
            }
          })
      );

    new Setting(containerEl)
      .setName("Excluded / included folders")
      .setDesc(
        createFragment((el) => {
          el.appendText("OFF — listed folders are excluded from review.");
          el.createEl("br");
          el.appendText(
            "ON — only listed folders are reviewed (empty list = nothing reviewed)."
          );
        })
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.folderFilterMode === "included")
          .onChange(async (value) => {
            this.plugin.settings.folderFilterMode = value
              ? "included"
              : "excluded";
            await this.plugin.saveSettings();
            this.refreshReviewState();
            this.display();
          })
      );

    const isIncluded = this.plugin.settings.folderFilterMode === "included";
    new Setting(containerEl)
      .setName(isIncluded ? "Global included folders" : "Global excluded folders")
      .setDesc("One path per line, relative to vault root.")
      .addTextArea((text) => {
        const currentList = isIncluded
          ? this.plugin.settings.includedFolders
          : this.plugin.settings.excludedFolders;
        text
          .setPlaceholder(
            isIncluded ? "Notes\nJournal" : "Templates\nAttachments\nArchive"
          )
          .setValue(currentList.join("\n"))
          .onChange(async (value) => {
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
            await this.plugin.saveSettings();
            this.scheduleReviewStateRefresh();
          });
        text.inputEl.rows = 5;
        text.inputEl.addClass("review-settings-textarea");
      });

    new Setting(containerEl)
      .setName("Folder-specific intervals")
      .setDesc(
        'Custom review intervals per folder. Format: "folder/path,days" — one rule per line. ' +
          "Uses longest matching path when rules overlap. Example: Daily Notes,90"
      )
      .addTextArea((text) => {
        text
          // eslint-disable-next-line obsidianmd/ui/sentence-case -- technical placeholder values, not prose UI copy
          .setPlaceholder("Notes,90\nProjects/Portfolio,30")
          .setValue(
            this.plugin.settings.folderIntervals
              .map((r) => `${r.folder},${r.days}`)
              .join("\n")
          )
          .onChange(async (value) => {
            this.plugin.settings.folderIntervals = value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .flatMap((line) => {
                const idx = line.lastIndexOf(",");
                if (idx < 1) return [];
                const folder = line.slice(0, idx).trim();
                const days = parseInt(line.slice(idx + 1));
                if (!folder || isNaN(days) || days <= 0) return [];
                return [{ folder: normalizePath(folder), days }];
              });
            await this.plugin.saveSettings();
            this.scheduleReviewStateRefresh();
          });
        text.inputEl.rows = 5;
        text.inputEl.addClass("review-settings-textarea");
      });

    new Setting(containerEl).setName("UI").setHeading();

    new Setting(containerEl)
      .setName("Show review status in status bar")
      .setDesc(
        "Shows per-file review indicator (last review date / due / not reviewed) for the active note."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showReviewStatus)
          .onChange(async (value) => {
            this.plugin.settings.showReviewStatus = value;
            await this.plugin.saveSettings();
            this.refreshReviewState();
          })
      );

    new Setting(containerEl)
      .setName("Show due counter in status bar")
      .setDesc(
        "Shows total count of notes due for review across vault, next to the current-note indicator."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showDueCounter)
          .onChange(async (value) => {
            this.plugin.settings.showDueCounter = value;
            await this.plugin.saveSettings();
            this.refreshReviewState();
          })
      );

    new Setting(containerEl)
      .setName("Show ribbon icon")
      .setDesc("Adds a left ribbon button that opens a random note due for review.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showRibbonIcon)
          .onChange(async (value) => {
            this.plugin.settings.showRibbonIcon = value;
            await this.plugin.saveSettings();
            this.plugin.updateRibbonIcon();
          })
      );

    new Setting(containerEl).setName("Advanced").setHeading();

    new Setting(containerEl)
      .setName("Frontmatter interval key")
      .setDesc(
        'Frontmatter field for per-file interval override. Set to a number (days) or "never" to exclude.'
      )
      .addText((text) =>
        text
          // eslint-disable-next-line obsidianmd/ui/sentence-case -- frontmatter keys are case-sensitive technical values
          .setPlaceholder("review_interval")
          .setValue(this.plugin.settings.frontmatterIntervalKey)
          .onChange(async (value) => {
            const v = value.trim();
            if (v) {
              this.plugin.settings.frontmatterIntervalKey = v;
              await this.plugin.saveSettings();
              this.refreshReviewState();
            }
          })
      );

    new Setting(containerEl)
      .setName("Frontmatter reviewed key")
      .setDesc("Frontmatter field where the last review date is stored.")
      .addText((text) =>
        text
          // eslint-disable-next-line obsidianmd/ui/sentence-case -- frontmatter keys are case-sensitive technical values
          .setPlaceholder("reviewed")
          .setValue(this.plugin.settings.frontmatterReviewedKey)
          .onChange(async (value) => {
            const v = value.trim();
            if (v) {
              this.plugin.settings.frontmatterReviewedKey = v;
              await this.plugin.saveSettings();
              this.refreshReviewState();
            }
          })
      );
  }
}
