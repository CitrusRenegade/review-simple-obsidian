import { describe, expect, it } from "vitest";
import type { App, TFile } from "obsidian";
import {
  countDue,
  getCalendarDaysSince,
  getEffectiveInterval,
  getLastReviewed,
  getOverdueRatioScore,
  getReviewableFiles,
  isDue,
  NEVER_REVIEWED_RANDOM_SCORE,
  pickRandomDue,
  pickTournamentWinner,
} from "../src/review";
import type { ReviewSettings } from "../src/settings";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.UTC(2026, 0, 31);

function daysAgo(days: number): Date {
  return new Date(NOW_MS - days * DAY_MS);
}

function randomSequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

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

function file(path: string): TFile {
  return { path, extension: "md" } as TFile;
}

function appWithFrontmatter(
  frontmatterByPath: Record<string, Record<string, unknown>>,
  paths = Object.keys(frontmatterByPath)
): App {
  const markdownFiles = paths.map((path) => file(path));
  return {
    metadataCache: {
      getFileCache: (target: TFile) => ({
        frontmatter: frontmatterByPath[target.path] ?? {},
      }),
    },
    vault: {
      getMarkdownFiles: () => markdownFiles,
    },
  } as unknown as App;
}

describe("pickTournamentWinner", () => {
  it("returns null when no notes are due", () => {
    expect(pickTournamentWinner([], () => 0)).toBeNull();
  });

  it("returns the only due note when there is one", () => {
    expect(pickTournamentWinner(["only"], () => 0)).toBe("only");
  });

  it("samples two distinct candidates for tournament selection", () => {
    const scored: string[] = [];
    const result = pickTournamentWinner(
      ["a", "b", "c"],
      (item) => {
        scored.push(item);
        return item === "b" ? 2 : 1;
      },
      randomSequence(0, 0)
    );

    expect(result).toBe("b");
    expect(scored).toHaveLength(2);
    expect(new Set(scored)).toEqual(new Set(["a", "b"]));
  });

  it("returns the candidate with the higher overdue ratio", () => {
    const result = pickTournamentWinner(
      [
        { id: "barely-due", reviewed: daysAgo(31), interval: 30 },
        { id: "stale", reviewed: daysAgo(90), interval: 30 },
      ],
      (item) => getOverdueRatioScore(item.reviewed, item.interval, NOW_MS),
      randomSequence(0, 0)
    );

    expect(result?.id).toBe("stale");
  });

  it("prefers a stale weekly note over a barely stale yearly note", () => {
    const result = pickTournamentWinner(
      [
        { id: "yearly", reviewed: daysAgo(395), interval: 365 },
        { id: "weekly", reviewed: daysAgo(21), interval: 7 },
      ],
      (item) => getOverdueRatioScore(item.reviewed, item.interval, NOW_MS),
      randomSequence(0, 0)
    );

    expect(result?.id).toBe("weekly");
  });

  it("scores never-reviewed notes moderately above barely-due notes", () => {
    expect(getOverdueRatioScore(null, 30, NOW_MS)).toBe(
      NEVER_REVIEWED_RANDOM_SCORE
    );

    const neverBeatsBarelyDue = pickTournamentWinner(
      [
        { id: "never", reviewed: null, interval: 30 },
        { id: "barely-due", reviewed: daysAgo(31), interval: 30 },
      ],
      (item) => getOverdueRatioScore(item.reviewed, item.interval, NOW_MS),
      randomSequence(0, 0)
    );
    const staleBeatsNever = pickTournamentWinner(
      [
        { id: "never", reviewed: null, interval: 30 },
        { id: "stale", reviewed: daysAgo(90), interval: 30 },
      ],
      (item) => getOverdueRatioScore(item.reviewed, item.interval, NOW_MS),
      randomSequence(0, 0)
    );

    expect(neverBeatsBarelyDue?.id).toBe("never");
    expect(staleBeatsNever?.id).toBe("stale");
  });

  it("returns one candidate when tournament scores are equal", () => {
    const result = pickTournamentWinner(["a", "b"], () => 1, randomSequence(0, 0));

    expect(["a", "b"]).toContain(result);
  });
});

describe("getEffectiveInterval", () => {
  it("lets frontmatter interval include notes outside included-only folders", () => {
    const interval = getEffectiveInterval(
      file("Notes/a.md"),
      appWithFrontmatter({ "Notes/a.md": { review_interval: 7 } }),
      {
        ...baseSettings,
        folderFilterMode: "included",
        includedFolders: [],
      }
    );

    expect(interval).toBe(7);
  });

  it("lets frontmatter interval include notes in excluded folders", () => {
    const interval = getEffectiveInterval(
      file("Archive/a.md"),
      appWithFrontmatter({ "Archive/a.md": { review_interval: 7 } }),
      {
        ...baseSettings,
        excludedFolders: ["Archive"],
      }
    );

    expect(interval).toBe(7);
  });

  it("lets frontmatter never exclude notes that folder rules would include", () => {
    const interval = getEffectiveInterval(
      file("Notes/a.md"),
      appWithFrontmatter({ "Notes/a.md": { review_interval: "never" } }),
      {
        ...baseSettings,
        folderFilterMode: "included",
        includedFolders: ["Notes"],
        folderIntervals: [{ folder: "Notes", days: 7 }],
      }
    );

    expect(interval).toBeNull();
  });

  it("does not let folder intervals override excluded folders", () => {
    const interval = getEffectiveInterval(
      file("Archive/a.md"),
      appWithFrontmatter({}),
      {
        ...baseSettings,
        excludedFolders: ["Archive"],
        folderIntervals: [{ folder: "Archive", days: 7 }],
      }
    );

    expect(interval).toBeNull();
  });

  it("applies included-only filtering when a note has no frontmatter interval", () => {
    const interval = getEffectiveInterval(
      file("Notes/a.md"),
      appWithFrontmatter({}),
      {
        ...baseSettings,
        folderFilterMode: "included",
        includedFolders: ["Projects"],
      }
    );

    expect(interval).toBeNull();
  });

  it("does not let invalid frontmatter intervals bypass folder filtering", () => {
    const interval = getEffectiveInterval(
      file("Notes/a.md"),
      appWithFrontmatter({ "Notes/a.md": { review_interval: 0 } }),
      {
        ...baseSettings,
        folderFilterMode: "included",
        includedFolders: ["Projects"],
      }
    );

    expect(interval).toBeNull();
  });

  it("requires strict positive integer frontmatter intervals", () => {
    const settings: ReviewSettings = {
      ...baseSettings,
      folderFilterMode: "included",
      includedFolders: [],
    };

    for (const value of ["7 days", "7abc", "1e2", "7.5", 7.5, 0]) {
      expect(
        getEffectiveInterval(
          file("Loose/a.md"),
          appWithFrontmatter({ "Loose/a.md": { review_interval: value } }),
          settings
        )
      ).toBeNull();
    }

    expect(
      getEffectiveInterval(
        file("Loose/a.md"),
        appWithFrontmatter({ "Loose/a.md": { review_interval: "08" } }),
        settings
      )
    ).toBe(8);
  });
});

describe("reviewable and due files", () => {
  it("uses frontmatter interval as a per-note opt-in for due counts and random picks", () => {
    const app = appWithFrontmatter(
      {
        "Loose/manual.md": { review_interval: 7 },
        "Loose/plain.md": {},
      },
      ["Loose/manual.md", "Loose/plain.md"]
    );
    const settings: ReviewSettings = {
      ...baseSettings,
      folderFilterMode: "included",
      includedFolders: [],
    };

    expect(getReviewableFiles(app, settings).map((f) => f.path)).toEqual([
      "Loose/manual.md",
    ]);
    expect(countDue(app, settings)).toBe(1);
    expect(pickRandomDue(app, settings, randomSequence(0))?.path).toBe(
      "Loose/manual.md"
    );
  });

  it("keeps frontmatter never stronger than included folders in reviewable lists", () => {
    const app = appWithFrontmatter(
      {
        "Notes/a.md": { review_interval: "never" },
        "Notes/b.md": {},
      },
      ["Notes/a.md", "Notes/b.md"]
    );
    const settings: ReviewSettings = {
      ...baseSettings,
      folderFilterMode: "included",
      includedFolders: ["Notes"],
    };

    expect(getReviewableFiles(app, settings).map((f) => f.path)).toEqual([
      "Notes/b.md",
    ]);
  });
});

describe("getLastReviewed", () => {
  it("parses date-only frontmatter as a local date", () => {
    const last = getLastReviewed(
      file("Notes/a.md"),
      appWithFrontmatter({ "Notes/a.md": { reviewed: "2026-06-10" } }),
      baseSettings
    );

    expect(last?.getFullYear()).toBe(2026);
    expect(last?.getMonth()).toBe(5);
    expect(last?.getDate()).toBe(10);
  });

  it("ignores impossible date-only frontmatter values", () => {
    const last = getLastReviewed(
      file("Notes/a.md"),
      appWithFrontmatter({ "Notes/a.md": { reviewed: "2026-02-31" } }),
      baseSettings
    );

    expect(last).toBeNull();
  });
});

describe("isDue", () => {
  it("uses calendar-day age instead of elapsed milliseconds", () => {
    const app = appWithFrontmatter({
      "Notes/a.md": { reviewed: "2026-06-10" },
    });

    expect(
      isDue(file("Notes/a.md"), app, baseSettings, new Date(2026, 6, 24, 23))
    ).toBe(false);
    expect(
      isDue(file("Notes/a.md"), app, baseSettings, new Date(2026, 6, 25, 0))
    ).toBe(true);
  });

  it("does not count negative calendar-day age for future reviewed dates", () => {
    expect(
      getCalendarDaysSince(new Date(2026, 6, 25), new Date(2026, 6, 24))
    ).toBe(0);
  });
});
