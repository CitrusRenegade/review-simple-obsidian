import { Component } from "obsidian";
import {
  formatCalculationMode,
  formatCalculationRows,
  formatReviewTiming,
  type ReviewDetails,
} from "./reviewDetails";
import {
  calculateCalculationRowMinimumWidth,
  calculatePopoverMinimumRequiredWidth,
  calculatePopoverPosition,
  calculatePopoverWidth,
} from "./reviewDetailsPopoverPosition";
import { runReviewDetailsAction } from "./reviewDetailsAction";

export class ReviewDetailsPopover extends Component {
  private popoverEl: HTMLElement | null = null;
  private calculationEl: HTMLDetailsElement | null = null;
  private headerEl: HTMLElement | null = null;
  private timingEl: HTMLElement | null = null;
  private lastReviewedEl: HTMLElement | null = null;
  private markButtonEl: HTMLButtonElement | null = null;
  private confirming = false;
  private opened = false;
  private previouslyFocusedEl: HTMLElement | null = null;
  private restoreFocusOnUnload = true;

  constructor(
    private readonly popupDocument: Document,
    private readonly anchorEl: HTMLElement | null,
    private readonly details: ReviewDetails,
    private readonly onMarkReviewed: () => Promise<boolean>,
    private readonly onClose: () => void
  ) {
    super();
  }

  onload(): void {
    this.opened = true;
    const doc = this.popupDocument;
    this.previouslyFocusedEl =
      doc.activeElement instanceof doc.defaultView!.HTMLElement
        ? doc.activeElement
        : null;
    const popupWindow = doc.win as Window & { createDiv(): HTMLDivElement };
    const root = popupWindow.createDiv();
    root.addClass("review-details-popover");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Review details");
    root.tabIndex = -1;
    this.popoverEl = root;

    const headerEl = root.createDiv({ cls: "review-details-header" });
    this.headerEl = headerEl;
    const summaryEl = headerEl.createDiv({ cls: "review-details-summary" });
    this.timingEl = summaryEl.createDiv({
      cls: "review-details-timing",
      text: formatReviewTiming(this.details.timing, this.details.nextReviewDay),
    });
    this.lastReviewedEl = summaryEl.createDiv({
      cls: "review-details-last-reviewed",
      text: this.details.lastReviewedDay
        ? `Last reviewed ${this.details.lastReviewedDay}`
        : "Never reviewed",
    });
    const actionsEl = headerEl.createDiv({ cls: "review-details-actions" });
    const markButton = actionsEl.createEl("button", {
      cls: "mod-cta",
      text: "Mark reviewed",
    });
    this.markButtonEl = markButton;
    this.registerDomEvent(markButton, "click", () => {
      void this.confirmReview(markButton);
    });

    const calculationEl = root.createEl("details", {
      cls: "review-details-calculation",
    });
    this.calculationEl = calculationEl;
    calculationEl.createEl("summary", { text: "How calculated" });
    calculationEl.createDiv({
      cls: "review-details-mode",
      text: formatCalculationMode(this.details.calculation.mode),
    });

    const rowsEl = calculationEl.createEl("ol", {
      cls: "review-details-calculation-list",
    });
    for (const row of formatCalculationRows(this.details.calculation.candidates)) {
      const rowEl = rowsEl.createEl("li", {
        cls: "review-details-calculation-row",
      });
      rowEl.toggleClass("is-applied", row.applied);
      rowEl.createSpan({
        cls: "review-details-calculation-position",
        text: String(row.position),
        attr: { "aria-hidden": "true" },
      });
      rowEl.createSpan({
        cls: "review-details-calculation-label",
        text: row.label,
      });
      rowEl.createSpan({
        cls: "review-details-calculation-value",
        text: row.value,
      });
      rowEl.createSpan({
        cls: "review-details-calculation-applied",
        text: row.applied ? "✓" : "",
        attr: { "aria-label": row.applied ? "Applied interval" : "" },
      });
    }

    doc.body.append(root);
    this.position();
    root.focus({ preventScroll: true });

    this.registerDomEvent(calculationEl, "toggle", () => this.position());

    this.registerDomEvent(doc, "pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof doc.defaultView!.Node)) return;
      if (root.contains(target) || this.anchorEl?.contains(target)) return;
      this.close();
    });
    this.registerDomEvent(doc, "keydown", (event) => {
      if (event.key === "Escape") this.close();
    });

    const viewWindow = doc.defaultView;
    if (viewWindow) {
      this.registerDomEvent(viewWindow, "resize", () => this.position());
      this.registerDomEvent(viewWindow, "scroll", () => this.position(), true);
    }
  }

  onunload(): void {
    this.popoverEl?.remove();
    this.popoverEl = null;
    this.calculationEl = null;
    this.headerEl = null;
    this.timingEl = null;
    this.lastReviewedEl = null;
    this.markButtonEl = null;
    if (
      this.restoreFocusOnUnload &&
      this.previouslyFocusedEl?.isConnected
    ) {
      this.previouslyFocusedEl.focus({ preventScroll: true });
    }
    this.previouslyFocusedEl = null;
  }

  close(restoreFocus = true): void {
    if (!this.opened) return;
    this.opened = false;
    this.restoreFocusOnUnload = restoreFocus;
    this.unload();
    this.onClose();
  }

  private async confirmReview(markButton: HTMLButtonElement): Promise<void> {
    if (this.confirming) return;

    this.confirming = true;
    markButton.disabled = true;
    const outcome = await runReviewDetailsAction(
      this.onMarkReviewed,
      () => this.close()
    );
    if (outcome === "close") return;

    this.confirming = false;
    if (markButton.isConnected) {
      markButton.disabled = false;
      markButton.focus({ preventScroll: true });
    }
  }

  private position(): void {
    const root = this.popoverEl;
    const viewWindow = this.popupDocument.defaultView;
    if (!root || !viewWindow) return;

    const anchorRect = this.anchorEl?.getBoundingClientRect() ?? {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    const parsedRootFontSize = Number.parseFloat(
      viewWindow.getComputedStyle(this.popupDocument.documentElement).fontSize
    );
    const rootFontSize =
      Number.isFinite(parsedRootFontSize) && parsedRootFontSize > 0
        ? parsedRootFontSize
        : 16;
    root.removeClass("is-width-constrained");
    const rootStyle = viewWindow.getComputedStyle(root);
    const headerStyle = this.headerEl
      ? viewWindow.getComputedStyle(this.headerEl)
      : null;
    const summaryWidth = Math.max(
      this.timingEl?.scrollWidth ?? 0,
      this.lastReviewedEl?.scrollWidth ?? 0
    );
    const buttonWidth = this.markButtonEl?.getBoundingClientRect().width ?? 0;
    const horizontalPadding =
      Number.parseFloat(rootStyle.paddingLeft) +
      Number.parseFloat(rootStyle.paddingRight);
    const horizontalBorder =
      Number.parseFloat(rootStyle.borderLeftWidth) +
      Number.parseFloat(rootStyle.borderRightWidth);
    const headerGap = Number.parseFloat(headerStyle?.columnGap ?? "0");
    const headerContentWidth =
      summaryWidth + buttonWidth + headerGap;
    let calculationContentWidth = 0;
    if (this.calculationEl?.open) {
      const calculationSummary =
        this.calculationEl.querySelector<HTMLElement>("summary");
      const mode =
        this.calculationEl.querySelector<HTMLElement>(".review-details-mode");
      calculationContentWidth = Math.max(
        calculationSummary?.scrollWidth ?? 0,
        mode?.scrollWidth ?? 0
      );

      const rows = Array.from(
        this.calculationEl.querySelectorAll<HTMLElement>(
          ".review-details-calculation-row"
        )
      );
      for (const row of rows) {
        const label = row.querySelector<HTMLElement>(
          ".review-details-calculation-label"
        );
        const value = row.querySelector<HTMLElement>(
          ".review-details-calculation-value"
        );
        const applied = row.querySelector<HTMLElement>(
          ".review-details-calculation-applied"
        );
        const columnGap = Number.parseFloat(
          viewWindow.getComputedStyle(row).columnGap
        );
        calculationContentWidth = Math.max(
          calculationContentWidth,
          calculateCalculationRowMinimumWidth({
            positionWidth: rootFontSize,
            labelWidth: label?.scrollWidth ?? 0,
            valueWidth: value?.scrollWidth ?? 0,
            appliedWidth: applied?.scrollWidth ?? 0,
            columnGap,
          })
        );
      }
    }
    const contentWidth = Math.max(
      headerContentWidth,
      calculationContentWidth
    );
    const minimumRequiredWidthWithoutScrollbar =
      calculatePopoverMinimumRequiredWidth({
        contentWidth,
        horizontalPadding,
        horizontalBorder,
        verticalScrollbarGutter: 0,
      });
    const preliminaryWidth = calculatePopoverWidth({
      viewportWidth: viewWindow.innerWidth,
      minimumRequiredWidth: minimumRequiredWidthWithoutScrollbar,
    });
    root.style.width = `${preliminaryWidth}px`;
    root.toggleClass(
      "is-width-constrained",
      preliminaryWidth < minimumRequiredWidthWithoutScrollbar
    );
    this.applyPosition(root, anchorRect, viewWindow);

    const verticalScrollbarGutter = Math.max(
      0,
      root.offsetWidth - root.clientWidth - horizontalBorder
    );
    const minimumRequiredWidth = calculatePopoverMinimumRequiredWidth({
      contentWidth,
      horizontalPadding,
      horizontalBorder,
      verticalScrollbarGutter,
    });
    const finalWidth = calculatePopoverWidth({
      viewportWidth: viewWindow.innerWidth,
      minimumRequiredWidth,
    });
    root.style.width = `${finalWidth}px`;
    root.toggleClass("is-width-constrained", finalWidth < minimumRequiredWidth);
    this.applyPosition(root, anchorRect, viewWindow);
  }

  private applyPosition(
    root: HTMLElement,
    anchorRect: DOMRect,
    viewWindow: Window
  ): void {
    const popoverRect = root.getBoundingClientRect();
    const position = calculatePopoverPosition({
      anchor: anchorRect,
      popoverWidth: popoverRect.width,
      viewportWidth: viewWindow.innerWidth,
      viewportHeight: viewWindow.innerHeight,
    });

    root.style.left = `${position.left}px`;
    root.style.bottom = `${position.bottom}px`;
    root.style.maxHeight = `${Math.max(0, viewWindow.innerHeight - position.bottom - 8)}px`;
  }
}
