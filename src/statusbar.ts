import { App, TFile, setIcon } from "obsidian";
import { ReviewSettings } from "./settings";
import {
  DueCounterCache,
  getEffectiveInterval,
  getLastReviewedDay,
  isDue,
} from "./review";
import { ConfirmReviewModal } from "./modal";

export class ReviewStatusBar {
  private el: HTMLElement;
  private app: App;
  private getSettings: () => ReviewSettings;
  private markReviewed: (file: TFile) => Promise<void>;
  private currentFile: TFile | null = null;

  constructor(
    statusBarEl: HTMLElement,
    app: App,
    getSettings: () => ReviewSettings,
    markReviewed: (file: TFile) => Promise<void>
  ) {
    this.el = statusBarEl;
    this.app = app;
    this.getSettings = getSettings;
    this.markReviewed = markReviewed;

    this.el.addClass("review-status-bar");
    this.el.addEventListener("click", () => this.onClick());
  }

  update(file: TFile | null): void {
    this.currentFile = file;
    const settings = this.getSettings();

    if (!settings.showReviewStatus) {
      this.el.addClass("review-hidden");
      return;
    }

    if (!file || file.extension !== "md") {
      this.el.addClass("review-hidden");
      return;
    }

    const interval = getEffectiveInterval(file, this.app, settings);

    if (interval === null) {
      this.el.addClass("review-hidden");
      return;
    }

    this.el.removeClass("review-hidden");
    const lastReviewedDay = getLastReviewedDay(file, this.app, settings);

    if (!lastReviewedDay) {
      this.el.setText("⚠ Not reviewed");
    } else if (isDue(file, this.app, settings)) {
      this.el.setText(`⚠ due · ${lastReviewedDay}`);
    } else {
      this.el.setText(`✓ ${lastReviewedDay}`);
    }
  }

  private onClick(): void {
    const file = this.currentFile;
    if (!file || file.extension !== "md") return;

    const settings = this.getSettings();
    const interval = getEffectiveInterval(file, this.app, settings);
    if (interval === null) return;

    new ConfirmReviewModal(this.app, file, () => this.markReviewed(file)).open();
  }
}

export class DueCounterStatusBar {
  private el: HTMLElement;
  private getSettings: () => ReviewSettings;
  private countEl: HTMLElement;
  private cache: DueCounterCache;

  constructor(
    statusBarEl: HTMLElement,
    app: App,
    getSettings: () => ReviewSettings,
    onClick: () => void
  ) {
    this.el = statusBarEl;
    this.getSettings = getSettings;
    this.cache = new DueCounterCache(app, getSettings);

    this.el.addClass("review-due-counter");
    this.el.setAttribute("data-tooltip-position", "top");
    const iconEl = this.el.createSpan({ cls: "review-due-counter-icon" });
    setIcon(iconEl, "clipboard-clock");
    this.countEl = this.el.createSpan({ cls: "review-due-counter-text" });
    this.el.addEventListener("click", onClick);
  }

  update(): void {
    const settings = this.getSettings();
    if (!settings.showDueCounter) {
      this.el.addClass("review-hidden");
      return;
    }

    const n = this.cache.countDue();
    this.countEl.setText(String(n));
    this.el.setAttribute(
      "aria-label",
      `${n} notes due for review across vault. Click to open random one.`
    );
    this.el.toggleClass("review-hidden", n === 0);
  }

  invalidateAll(): void {
    this.cache.invalidateAll();
  }

  invalidateFile(file: TFile): void {
    this.cache.invalidateFile(file);
  }

  removeFile(pathOrFile: string | TFile): void {
    this.cache.removeFile(pathOrFile);
  }

  renameFile(file: TFile, oldPath: string): void {
    this.cache.renameFile(file, oldPath);
  }
}
