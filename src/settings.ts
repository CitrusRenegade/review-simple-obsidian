import { App, PluginSettingTab, Setting } from "obsidian";
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
  frontmatterIntervalKey: string;
  frontmatterReviewedKey: string;
}

export const DEFAULT_SETTINGS: ReviewSettings = {
  globalIntervalDays: 45,
  folderFilterMode: "excluded",
  excludedFolders: [],
  includedFolders: [],
  folderIntervals: [],
  frontmatterIntervalKey: "review_interval",
  frontmatterReviewedKey: "reviewed",
};

export class ReviewSettingTab extends PluginSettingTab {
  plugin: ReviewPlugin;

  constructor(app: App, plugin: ReviewPlugin) {
    super(app, plugin);
    this.plugin = plugin;
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
            }
          })
      );

    new Setting(containerEl)
      .setName("Excluded / Included folders")
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
              .map((s) => s.trim().replace(/\/+$/, ""))
              .filter(Boolean);
            if (isIncluded) {
              this.plugin.settings.includedFolders = parsed;
            } else {
              this.plugin.settings.excludedFolders = parsed;
            }
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
      });

    new Setting(containerEl)
      .setName("Folder-specific intervals")
      .setDesc(
        'Custom review intervals per folder. Format: "folder/path,days" — one rule per line. ' +
          "Uses longest matching path when rules overlap. Example: Daily Notes,90"
      )
      .addTextArea((text) => {
        text
          .setPlaceholder("Daily Notes,90\nWork/Projects,30")
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
                const folder = line.slice(0, idx).trim().replace(/\/+$/, "");
                const days = parseInt(line.slice(idx + 1));
                if (!folder || isNaN(days) || days <= 0) return [];
                return [{ folder, days }];
              });
            await this.plugin.saveSettings();
          });
        text.inputEl.rows = 5;
      });

    containerEl.createEl("h3", { text: "Advanced" });

    new Setting(containerEl)
      .setName("Frontmatter interval key")
      .setDesc(
        'Frontmatter field for per-file interval override. Set to a number (days) or "never" to exclude.'
      )
      .addText((text) =>
        text
          .setPlaceholder("review_interval")
          .setValue(this.plugin.settings.frontmatterIntervalKey)
          .onChange(async (value) => {
            const v = value.trim();
            if (v) {
              this.plugin.settings.frontmatterIntervalKey = v;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Frontmatter reviewed key")
      .setDesc("Frontmatter field where the last review date is stored.")
      .addText((text) =>
        text
          .setPlaceholder("reviewed")
          .setValue(this.plugin.settings.frontmatterReviewedKey)
          .onChange(async (value) => {
            const v = value.trim();
            if (v) {
              this.plugin.settings.frontmatterReviewedKey = v;
              await this.plugin.saveSettings();
            }
          })
      );
  }
}
