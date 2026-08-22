import { describe, expect, it } from "vitest";
import {
  calculateCalculationRowMinimumWidth,
  calculatePopoverMinimumRequiredWidth,
  calculatePopoverPosition,
  calculatePopoverWidth,
} from "../src/reviewDetailsPopoverPosition";

describe("calculateCalculationRowMinimumWidth", () => {
  it("keeps every calculation column on one line when the viewport allows it", () => {
    expect(
      calculateCalculationRowMinimumWidth({
        rootFontSize: 16,
        labelWidth: 100,
        valueWidth: 220,
        columnGap: 8,
      })
    ).toBe(396);
  });
});

describe("calculatePopoverMinimumRequiredWidth", () => {
  it("reserves the vertical scrollbar gutter for one-line content", () => {
    expect(
      calculatePopoverMinimumRequiredWidth({
        contentWidth: 352,
        horizontalPadding: 28,
        horizontalBorder: 2,
        verticalScrollbarGutter: 15,
      })
    ).toBe(397);
  });
});

describe("calculatePopoverWidth", () => {
  it("uses a compact collapsed width and a wider expanded width, clamped on mobile", () => {
    expect(
      calculatePopoverWidth({
        expanded: false,
        rootFontSize: 16,
        viewportWidth: 1440,
      })
    ).toBe(320);
    expect(
      calculatePopoverWidth({
        expanded: true,
        rootFontSize: 16,
        viewportWidth: 1440,
      })
    ).toBe(352);
    expect(
      calculatePopoverWidth({
        expanded: true,
        rootFontSize: 16,
        viewportWidth: 300,
      })
    ).toBe(284);
  });

  it("expands to the measured one-line header width until the viewport constrains it", () => {
    expect(
      calculatePopoverWidth({
        expanded: false,
        rootFontSize: 16,
        viewportWidth: 1440,
        minimumRequiredWidth: 390,
      })
    ).toBe(390);
    expect(
      calculatePopoverWidth({
        expanded: false,
        rootFontSize: 16,
        viewportWidth: 360,
        minimumRequiredWidth: 390,
      })
    ).toBe(344);
  });
});

describe("calculatePopoverPosition", () => {
  it("anchors the popup by its bottom edge so expanding content grows upward", () => {
    expect(
      calculatePopoverPosition({
        anchor: {
          top: 1000,
          right: 1400,
          bottom: 1020,
          width: 20,
          height: 20,
        },
        popoverWidth: 360,
        viewportWidth: 1440,
        viewportHeight: 1080,
      })
    ).toEqual({ left: 1040, bottom: 88 });
  });

  it("uses a centered bottom position when the status item is not visible", () => {
    expect(
      calculatePopoverPosition({
        anchor: {
          top: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
        },
        popoverWidth: 360,
        viewportWidth: 1440,
        viewportHeight: 1080,
      })
    ).toEqual({ left: 540, bottom: 8 });
  });
});
