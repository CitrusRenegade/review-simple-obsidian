export interface PopoverAnchorRect {
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface PopoverPositionInput {
  anchor: PopoverAnchorRect;
  popoverWidth: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface PopoverPosition {
  left: number;
  bottom: number;
}

export interface PopoverWidthInput {
  expanded: boolean;
  rootFontSize: number;
  viewportWidth: number;
  minimumRequiredWidth?: number;
}

export interface CalculationRowWidthInput {
  rootFontSize: number;
  labelWidth: number;
  valueWidth: number;
  columnGap: number;
}

export interface PopoverMinimumRequiredWidthInput {
  contentWidth: number;
  horizontalPadding: number;
  horizontalBorder: number;
  verticalScrollbarGutter: number;
}

export function calculateCalculationRowMinimumWidth({
  rootFontSize,
  labelWidth,
  valueWidth,
  columnGap,
}: CalculationRowWidthInput): number {
  const fixedColumnsWidth = rootFontSize * 2;
  const minimumLabelWidth = rootFontSize * 7.5;
  return (
    fixedColumnsWidth +
    Math.max(minimumLabelWidth, labelWidth) +
    valueWidth +
    columnGap * 3
  );
}

export function calculatePopoverMinimumRequiredWidth({
  contentWidth,
  horizontalPadding,
  horizontalBorder,
  verticalScrollbarGutter,
}: PopoverMinimumRequiredWidthInput): number {
  return Math.ceil(
    contentWidth +
      horizontalPadding +
      horizontalBorder +
      verticalScrollbarGutter
  );
}

export function calculatePopoverWidth({
  expanded,
  rootFontSize,
  viewportWidth,
  minimumRequiredWidth = 0,
}: PopoverWidthInput): number {
  const margin = 8;
  const widthInRem = expanded ? 22 : 20;
  return Math.min(
    Math.max(widthInRem * rootFontSize, minimumRequiredWidth),
    viewportWidth - margin * 2
  );
}

export function calculatePopoverPosition({
  anchor,
  popoverWidth,
  viewportWidth,
  viewportHeight,
}: PopoverPositionInput): PopoverPosition {
  const margin = 8;
  const gap = 8;
  const hasVisibleAnchor = anchor.width > 0 && anchor.height > 0;
  const preferredLeft = hasVisibleAnchor
    ? anchor.right - popoverWidth
    : (viewportWidth - popoverWidth) / 2;

  return {
    left: Math.max(
      margin,
      Math.min(preferredLeft, viewportWidth - popoverWidth - margin)
    ),
    bottom: hasVisibleAnchor
      ? Math.max(margin, viewportHeight - anchor.top + gap)
      : margin,
  };
}
