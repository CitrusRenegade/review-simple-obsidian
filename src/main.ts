import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, ReviewSettings, ReviewSettingTab } from "./settings";
import { ReviewStatusBar } from "./statusbar";
import { getEffectiveInterval, pickRandomDue } from "./review";

export default class ReviewPlugin extends Plugin {
  settings!: ReviewSettings;
  private statusBar!: ReviewStatusBar;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new ReviewSettingTab(this.app, this));

    const statusBarEl = this.addStatusBarItem();
    this.statusBar = new ReviewStatusBar(
      statusBarEl,
      this.app,
      () => this.settings
    );

    this.addCommand({
      id: "open-random",
      name: "Open random note for review",
      callback: () => {
        const file = pickRandomDue(this.app, this.settings);
        if (!file) {
          new Notice("No notes due for review");
          return;
        }
        this.app.workspace.getLeaf(false).openFile(file);
      },
    });

    this.addCommand({
      id: "mark-current",
      name: "Mark current note as reviewed",
      callback: async () => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") {
          new Notice("No active markdown file");
          return;
        }
        const interval = getEffectiveInterval(file, this.app, this.settings);
        if (interval === null) {
          new Notice("This note is not tracked for review");
          return;
        }
        const today = new Date().toISOString().slice(0, 10);
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          fm[this.settings.frontmatterReviewedKey] = today;
        });
        new Notice("Marked as reviewed");
        this.statusBar.update(file);
      },
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.statusBar.update(this.app.workspace.getActiveFile());
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file: TFile) => {
        const active = this.app.workspace.getActiveFile();
        if (active && file.path === active.path) {
          this.statusBar.update(file);
        }
      })
    );

    this.statusBar.update(this.app.workspace.getActiveFile());
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
