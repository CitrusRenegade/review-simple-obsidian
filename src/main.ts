import {
  Menu,
  Notice,
  Plugin,
  TAbstractFile,
  TFile,
  TFolder,
  normalizePath,
} from "obsidian";
import {
  ReviewSettings,
  ReviewSettingTab,
  loadReviewSettings,
} from "./settings";
import { migrateRenamedFolderReviewRules } from "./folderRules";
import { DueCounterStatusBar, ReviewStatusBar } from "./statusbar";
import { getEffectiveInterval, pickRandomDue } from "./review";
import { setStringFrontmatter } from "./frontmatter";
import { formatLocalDate } from "./dates";

export default class ReviewPlugin extends Plugin {
  settings!: ReviewSettings;
  private statusBar: ReviewStatusBar | null = null;
  private dueCounter: DueCounterStatusBar | null = null;
  private ribbonIconEl: HTMLElement | null = null;
  private settingTab: ReviewSettingTab | null = null;
  private dueCounterRefreshTimeout: number | null = null;

  private openRandomDue(): void {
    const file = pickRandomDue(this.app, this.settings);
    if (!file) {
      new Notice("No notes due for review");
      return;
    }
    void this.app.workspace.getLeaf(false).openFile(file);
  }

  updateAll(): void {
    this.statusBar?.update(this.app.workspace.getActiveFile());
    this.refreshDueCounter();
  }

  refreshReviewState(): void {
    this.dueCounter?.invalidateAll();
    this.updateAll();
  }

  private refreshDueCounter(): void {
    if (this.dueCounterRefreshTimeout !== null) {
      activeWindow.clearTimeout(this.dueCounterRefreshTimeout);
      this.dueCounterRefreshTimeout = null;
    }
    this.dueCounter?.update();
  }

  private scheduleDueCounterRefresh(): void {
    if (this.dueCounterRefreshTimeout !== null) {
      activeWindow.clearTimeout(this.dueCounterRefreshTimeout);
      this.dueCounterRefreshTimeout = null;
    }
    if (!this.settings.showDueCounter) {
      return;
    }
    this.dueCounterRefreshTimeout = activeWindow.setTimeout(() => {
      this.dueCounterRefreshTimeout = null;
      this.dueCounter?.update();
    }, 500);
  }

  private async handleVaultRename(
    file: TAbstractFile,
    oldPath: string
  ): Promise<void> {
    if (file instanceof TFile) {
      this.dueCounter?.renameFile(file, oldPath);
      this.scheduleDueCounterRefresh();
      return;
    }

    this.dueCounter?.invalidateAll();

    if (!(file instanceof TFolder)) {
      this.scheduleDueCounterRefresh();
      return;
    }

    const changed = migrateRenamedFolderReviewRules(
      this.settings,
      oldPath,
      file.path
    );
    if (changed) {
      await this.saveSettings();
      this.updateAll();
      this.settingTab?.display();
      return;
    }

    this.scheduleDueCounterRefresh();
  }

  updateRibbonIcon(): void {
    if (this.settings.showRibbonIcon && !this.ribbonIconEl) {
      this.ribbonIconEl = this.addRibbonIcon(
        "clipboard-clock",
        "Open random note for review",
        () => this.openRandomDue()
      );
    } else if (!this.settings.showRibbonIcon && this.ribbonIconEl) {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }
  }

  private async markReviewed(file: TFile): Promise<void> {
    const today = formatLocalDate(new Date());
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        setStringFrontmatter(fm, this.settings.frontmatterReviewedKey, today);
      });
      new Notice("Marked as reviewed");
      this.dueCounter?.invalidateFile(file);
      this.updateAll();
    } catch (e) {
      console.error("Failed to mark as reviewed:", e);
      new Notice("Failed to mark note as reviewed");
    }
  }

  private addFileMenuItems(menu: Menu, file: TAbstractFile): void {
    if (!(file instanceof TFolder)) return;
    if (this.settings.folderFilterMode !== "excluded") return;

    const folderPath = normalizePath(file.path);
    if (!folderPath || this.settings.excludedFolders.includes(folderPath)) {
      return;
    }

    menu.addItem((item) => {
      item
        .setTitle("Exclude folder from review")
        .setIcon("folder-x")
        .onClick(() => {
          void this.excludeFolderFromReview(folderPath);
        });
    });
  }

  private async excludeFolderFromReview(folderPath: string): Promise<void> {
    if (this.settings.folderFilterMode !== "excluded") return;
    if (this.settings.excludedFolders.includes(folderPath)) return;

    this.settings.excludedFolders = [...this.settings.excludedFolders, folderPath];
    await this.saveSettings();
    this.refreshReviewState();
    new Notice("Folder excluded from review");
  }

  async onload(): Promise<void> {
    await this.loadSettings();

    this.settingTab = new ReviewSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    this.updateRibbonIcon();

    const statusBarEl = this.addStatusBarItem();
    this.register(() => statusBarEl.remove());
    this.statusBar = new ReviewStatusBar(
      statusBarEl,
      this.app,
      () => this.settings,
      (file) => this.markReviewed(file)
    );

    const counterEl = this.addStatusBarItem();
    this.register(() => counterEl.remove());
    this.dueCounter = new DueCounterStatusBar(
      counterEl,
      this.app,
      () => this.settings,
      () => this.openRandomDue()
    );

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
      this.app.workspace.on("file-open", (file) => {
        this.statusBar?.update(file);
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        this.addFileMenuItems(menu, file);
      })
    );

    this.registerEvent(
      this.app.metadataCache.on("changed", (file: TFile) => {
        const active = this.app.workspace.getActiveFile();
        if (active && file.path === active.path) {
          this.statusBar?.update(file);
        }
        this.dueCounter?.invalidateFile(file);
        this.scheduleDueCounterRefresh();
      })
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile) {
          this.dueCounter?.invalidateFile(file);
          this.scheduleDueCounterRefresh();
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        if (file instanceof TFile) {
          this.dueCounter?.removeFile(file);
        } else {
          this.dueCounter?.invalidateAll();
        }
        this.scheduleDueCounterRefresh();
      })
    );
    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        void this.handleVaultRename(file, oldPath);
      })
    );

    this.register(() => {
      if (this.dueCounterRefreshTimeout !== null) {
        activeWindow.clearTimeout(this.dueCounterRefreshTimeout);
        this.dueCounterRefreshTimeout = null;
      }
    });

    this.app.workspace.onLayoutReady(() => this.updateAll());
  }

  async loadSettings(): Promise<void> {
    this.settings = loadReviewSettings(await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async onExternalSettingsChange(): Promise<void> {
    await this.loadSettings();
    this.updateRibbonIcon();
    this.refreshReviewState();
    this.settingTab?.display();
  }
}
