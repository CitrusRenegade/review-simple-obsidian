import { App, Notice, TFile, setIcon } from "obsidian";
import { ReviewSettings } from "./settings";
import {
  countDue,
  getEffectiveInterval,
  getLastReviewed,
  isDue,
} from "./review";
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

export class DueCounterStatusBar {
  private el: HTMLElement;
  private app: App;
  private getSettings: () => ReviewSettings;
  private countEl: HTMLElement;

  constructor(
    statusBarEl: HTMLElement,
    app: App,
    getSettings: () => ReviewSettings,
    onClick: () => void
  ) {
    this.el = statusBarEl;
    this.app = app;
    this.getSettings = getSettings;

    this.el.addClass("review-due-counter");
    this.el.setAttribute("data-tooltip-position", "top");
    const iconEl = this.el.createSpan({ cls: "review-due-counter-icon" });
    setIcon(iconEl, "clipboard-clock");
    this.countEl = this.el.createSpan({ cls: "review-due-counter-text" });
    this.el.addEventListener("click", onClick);
  }

  update(): void {
    const n = countDue(this.app, this.getSettings());
    this.countEl.setText(String(n));
    this.el.setAttribute(
      "aria-label",
      `${n} notes due for review across vault`
    );
    this.el.style.display = n === 0 ? "none" : "";
  }
}
