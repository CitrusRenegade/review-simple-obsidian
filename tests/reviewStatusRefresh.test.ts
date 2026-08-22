import { describe, expect, it } from "vitest";
import { shouldRefreshActiveReviewAfterRename } from "../src/reviewStatusRefresh";

describe("shouldRefreshActiveReviewAfterRename", () => {
  it("refreshes an active renamed note but not an unrelated note", () => {
    expect(shouldRefreshActiveReviewAfterRename("file", true)).toBe(true);
    expect(shouldRefreshActiveReviewAfterRename("file", false)).toBe(false);
  });

  it("refreshes after a folder rename because the active note path may change", () => {
    expect(shouldRefreshActiveReviewAfterRename("folder", false)).toBe(true);
  });
});
