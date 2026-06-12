import { describe, expect, it } from "vitest";
import { migrateRenamedFolderReviewRules } from "../src/folderRules";
import type { ReviewSettings } from "../src/settings";

const baseSettings: ReviewSettings = {
  globalIntervalDays: 45,
  folderFilterMode: "excluded",
  excludedFolders: [],
  includedFolders: [],
  folderIntervals: [],
  showReviewStatus: true,
  showDueCounter: true,
  showRibbonIcon: false,
  frontmatterIntervalKey: "review_interval",
  frontmatterReviewedKey: "reviewed",
};

describe("migrateRenamedFolderReviewRules", () => {
  it("migrates exact folder rules and child folder rules", () => {
    const settings: ReviewSettings = {
      ...baseSettings,
      excludedFolders: ["Projects", "Projects/Archive"],
      includedFolders: ["Projects/Active"],
      folderIntervals: [
        { folder: "Projects", days: 30 },
        { folder: "Projects/Active", days: 7 },
      ],
    };

    expect(
      migrateRenamedFolderReviewRules(settings, "Projects", "Work")
    ).toBe(true);

    expect(settings.excludedFolders).toEqual(["Work", "Work/Archive"]);
    expect(settings.includedFolders).toEqual(["Work/Active"]);
    expect(settings.folderIntervals).toEqual([
      { folder: "Work", days: 30 },
      { folder: "Work/Active", days: 7 },
    ]);
  });

  it("does not migrate sibling paths with the same prefix", () => {
    const settings: ReviewSettings = {
      ...baseSettings,
      excludedFolders: ["Projects Archive", "ProjectsOld"],
      includedFolders: ["Projects"],
      folderIntervals: [{ folder: "ProjectsOld/Sub", days: 14 }],
    };

    expect(
      migrateRenamedFolderReviewRules(settings, "Projects", "Work")
    ).toBe(true);

    expect(settings.excludedFolders).toEqual(["Projects Archive", "ProjectsOld"]);
    expect(settings.includedFolders).toEqual(["Work"]);
    expect(settings.folderIntervals).toEqual([
      { folder: "ProjectsOld/Sub", days: 14 },
    ]);
  });

  it("normalizes renamed folder paths before migrating rules", () => {
    const settings: ReviewSettings = {
      ...baseSettings,
      excludedFolders: ["Projects/Active"],
    };

    expect(
      migrateRenamedFolderReviewRules(settings, "Projects\\Active", "Work\\Now")
    ).toBe(true);

    expect(settings.excludedFolders).toEqual(["Work/Now"]);
  });

  it("returns false when no rules match the renamed folder", () => {
    const settings: ReviewSettings = {
      ...baseSettings,
      excludedFolders: ["Archive"],
    };

    expect(
      migrateRenamedFolderReviewRules(settings, "Projects", "Work")
    ).toBe(false);
    expect(settings.excludedFolders).toEqual(["Archive"]);
  });

  it("returns false when old and new paths normalize to the same folder", () => {
    const settings: ReviewSettings = {
      ...baseSettings,
      excludedFolders: ["Projects"],
    };

    expect(
      migrateRenamedFolderReviewRules(settings, "Projects", "Projects")
    ).toBe(false);
    expect(settings.excludedFolders).toEqual(["Projects"]);
  });
});
