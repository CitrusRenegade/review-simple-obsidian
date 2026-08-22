import { describe, expect, it } from "vitest";
import type { TFile } from "obsidian";
import { ReviewedDayOverrides } from "../src/reviewedDayOverrides";

describe("ReviewedDayOverrides", () => {
  it("follows the same file across rename without affecting a replacement path", () => {
    const overrides = new ReviewedDayOverrides();
    const original = { path: "Projects/a.md" } as TFile;
    overrides.set(original, "reviewed", "2026-08-22");

    original.path = "Archive/a.md";
    const replacement = { path: "Projects/a.md" } as TFile;

    expect(overrides.get(original, "reviewed")).toBe("2026-08-22");
    expect(overrides.get(replacement, "reviewed")).toBeNull();
    overrides.delete(original);
    expect(overrides.get(original, "reviewed")).toBeNull();
  });

  it("does not restore a failed operation's override after its file was deleted", () => {
    const overrides = new ReviewedDayOverrides();
    const deleted = { path: "Projects/a.md" } as TFile;
    const replacement = { path: "Projects/a.md" } as TFile;

    expect(
      overrides.rollback(deleted, "reviewed", "2026-08-01", replacement)
    ).toBe(false);
    expect(overrides.get(deleted, "reviewed")).toBeNull();
    expect(
      overrides.rollback(deleted, "reviewed", "2026-08-01", null)
    ).toBe(false);
    expect(overrides.get(deleted, "reviewed")).toBeNull();
    expect(
      overrides.rollback(deleted, "reviewed", "2026-08-01", deleted)
    ).toBe(true);
    expect(overrides.get(deleted, "reviewed")).toBe("2026-08-01");
  });

  it("clears the optimistic value when a current file had no prior override", () => {
    const overrides = new ReviewedDayOverrides();
    const file = { path: "Projects/a.md" } as TFile;
    overrides.set(file, "reviewed", "2026-08-22");

    expect(overrides.rollback(file, "reviewed", null, file)).toBe(true);
    expect(overrides.get(file, "reviewed")).toBeNull();
  });

  it("discards an override when the configured frontmatter key changes", () => {
    const overrides = new ReviewedDayOverrides();
    const file = { path: "Projects/a.md" } as TFile;
    overrides.set(file, "reviewed", "2026-08-22");

    expect(overrides.get(file, "reviewed_at")).toBeNull();
    expect(overrides.get(file, "reviewed")).toBeNull();
  });
});
