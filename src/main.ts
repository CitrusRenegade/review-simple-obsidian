import { Notice, Plugin, TFile } from "obsidian";
import { DEFAULT_SETTINGS, ReviewSettings, ReviewSettingTab } from "./settings";
import { DueCounterStatusBar, ReviewStatusBar } from "./statusbar";
import { getEffectiveInterval, pickRandomDue } from "./review";

export default class ReviewPlugin extends Plugin {
  settings!: ReviewSettings;
  private statusBar: ReviewStatusBar | null = null;
  private dueCounter: DueCounterStatusBar | null = null;

  private openRandomDue(): void {
    const file = pickRandomDue(this.app, this.settings);
    if (!file) {
      new Notice("No notes due for review");
      return;
    }
    void this.app.workspace.getLeaf(false).openFile(file);
  }

  private updateAll(): void {
    this.statusBar?.update(this.app.workspace.getActiveFile());
    this.dueCounter?.update();
  }

  private async markReviewed(file: TFile): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm[this.settings.frontmatterReviewedKey] = today;
    });
    new Notice("Marked as reviewed");
    this.updateAll();
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new ReviewSettingTab(this.app, this));

    if (this.settings.showReviewStatus) {
      const statusBarEl = this.addStatusBarItem();
      this.register(() => statusBarEl.remove());
      this.statusBar = new ReviewStatusBar(
        statusBarEl,
        this.app,
        () => this.settings
      );
    }

    if (this.settings.showDueCounter) {
      const counterEl = this.addStatusBarItem();
      this.register(() => counterEl.remove());
      this.dueCounter = new DueCounterStatusBar(
        counterEl,
        this.app,
        () => this.settings,
        () => this.openRandomDue()
      );
    }

    this.addCommand({
      id: "open-random",
      name: "Open random note for review",
      callback: () => this.openRandomDue(),
    });

    this.addCommand({
      id: "mark-current",
      name: "Mark current note as reviewed",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || file.extension !== "md") return false;
        if (getEffectiveInterval(file, this.app, this.settings) === null) {
          return false;
        }
        if (!checking) {
          void this.markReviewed(file);
        }
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.statusBar?.update(this.app.workspace.getActiveFile());
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file: TFile) => {
        const active = this.app.workspace.getActiveFile();
        if (active && file.path === active.path) {
          this.statusBar?.update(file);
        }
        this.dueCounter?.update();
      })
    );

    this.registerEvent(
      this.app.vault.on("create", () => this.dueCounter?.update())
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.dueCounter?.update())
    );
    this.registerEvent(
      this.app.vault.on("rename", () => this.dueCounter?.update())
    );

    this.app.workspace.onLayoutReady(() => this.updateAll());
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
