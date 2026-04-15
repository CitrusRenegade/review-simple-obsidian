import { App, Notice, TFile } from "obsidian";
import { ReviewSettings } from "./settings";
import { getEffectiveInterval, getLastReviewed, isDue } from "./review";
import { ConfirmReviewModal } from "./modal";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export class ReviewStatusBar {
  private el: HTMLElement;
  private app: App;
  private getSettings: () => ReviewSettings;
  private currentFile: TFile | null = null;

  constructor(
    statusBarEl: HTMLElement,
    app: App,
    getSettings: () => ReviewSettings
  ) {
    this.el = statusBarEl;
    this.app = app;
    this.getSettings = getSettings;

    this.el.addClass("review-status-bar");
    this.el.addEventListener("click", () => this.onClick());
  }

  update(file: TFile | null): void {
    this.currentFile = file;

    if (!file || file.extension !== "md") {
      this.el.style.display = "none";
      return;
    }

    const settings = this.getSettings();
    const interval = getEffectiveInterval(file, this.app, settings);

    if (interval === null) {
      this.el.style.display = "none";
      return;
    }

    this.el.style.display = "";
    const last = getLastReviewed(file, this.app, settings);

    if (!last) {
      this.el.setText("⚠ not reviewed");
    } else if (isDue(file, this.app, settings)) {
      this.el.setText(`⚠ due · ${formatDate(last)}`);
    } else {
      this.el.setText(`✓ ${formatDate(last)}`);
    }
  }

  private onClick(): void {
    const file = this.currentFile;
    if (!file || file.extension !== "md") return;

    const settings = this.getSettings();
    const interval = getEffectiveInterval(file, this.app, settings);
    if (interval === null) return;

    new ConfirmReviewModal(this.app, file, () => {
      const today = formatDate(new Date());
      this.app.fileManager.processFrontMatter(file, (fm) => {
        fm[settings.frontmatterReviewedKey] = today;
      }).then(() => {
        new Notice("Marked as reviewed");
        this.update(file);
      });
    }).open();
  }
}
