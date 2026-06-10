import type { App, TFile } from "obsidian";
import type { FolderInterval, ReviewSettings } from "./settings";

const DAY_MS = 24 * 60 * 60 * 1000;
export const NEVER_REVIEWED_RANDOM_SCORE = 1.5;

type RandomSource = () => number;

function getFrontmatter(file: TFile, app: App): Record<string, unknown> {
  return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
}

function getRandomIndex(length: number, random: RandomSource): number {
  const value = random();
  if (value <= 0) return 0;
  if (value >= 1) return length - 1;
  return Math.floor(value * length);
}

export function getOverdueRatioScore(
  lastReviewed: Date | null,
  intervalDays: number,
  nowMs = Date.now()
): number {
  if (!lastReviewed) return NEVER_REVIEWED_RANDOM_SCORE;
  const daysSinceReviewed = Math.max(0, nowMs - lastReviewed.getTime()) / DAY_MS;
  return daysSinceReviewed / intervalDays;
}

export function pickTournamentWinner<T>(
  items: T[],
  getScore: (item: T) => number,
  random: RandomSource = Math.random
): T | null {
  if (items.length === 0) return null;
  if (items.length === 1) return items[0];

  const firstIndex = getRandomIndex(items.length, random);
  let secondIndex = getRandomIndex(items.length - 1, random);
  if (secondIndex >= firstIndex) secondIndex += 1;

  const first = items[firstIndex];
  const second = items[secondIndex];
  return getScore(second) > getScore(first) ? second : first;
}

export function isExcluded(file: TFile, settings: ReviewSettings): boolean {
  const list =
    settings.folderFilterMode === "included"
      ? settings.includedFolders
      : settings.excludedFolders;
  const inList = list.some((folder) => file.path.startsWith(folder + "/"));
  return settings.folderFilterMode === "included" ? !inList : inList;
}

export function getLocalInterval(
  file: TFile,
  app: App,
  settings: ReviewSettings
): number | "never" | null {
  const fm = getFrontmatter(file, app);
  const val = fm[settings.frontmatterIntervalKey];
  if (val === "never") return "never";
  if (typeof val === "number" && val > 0) return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

export function getFolderInterval(
  file: TFile,
  settings: ReviewSettings
): number | null {
  let best: FolderInterval | null = null;
  for (const rule of settings.folderIntervals) {
    if (file.path.startsWith(rule.folder + "/")) {
      if (!best || rule.folder.length > best.folder.length) {
        best = rule;
      }
    }
  }
  return best ? best.days : null;
}

export function getEffectiveInterval(
  file: TFile,
  app: App,
  settings: ReviewSettings
): number | null {
  const local = getLocalInterval(file, app, settings);
  if (local === "never") return null;
  if (typeof local === "number") return local;

  const folderInterval = getFolderInterval(file, settings);
  if (folderInterval !== null) return folderInterval;

  if (isExcluded(file, settings)) return null;

  return settings.globalIntervalDays;
}

export function getLastReviewed(
  file: TFile,
  app: App,
  settings: ReviewSettings
): Date | null {
  const fm = getFrontmatter(file, app);
  const val = fm[settings.frontmatterReviewedKey];
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val !== "string" && typeof val !== "number") return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function isDue(
  file: TFile,
  app: App,
  settings: ReviewSettings
): boolean {
  const interval = getEffectiveInterval(file, app, settings);
  if (interval === null) return false;
  const last = getLastReviewed(file, app, settings);
  if (!last) return true;
  return Date.now() - last.getTime() > interval * DAY_MS;
}

export function getReviewableFiles(
  app: App,
  settings: ReviewSettings
): TFile[] {
  return app.vault.getMarkdownFiles().filter((f) => {
    if (isExcluded(f, settings)) return false;
    const local = getLocalInterval(f, app, settings);
    if (local === "never") return false;
    return true;
  });
}

export function getDueFiles(app: App, settings: ReviewSettings): TFile[] {
  return getReviewableFiles(app, settings).filter((f) => isDue(f, app, settings));
}

export function pickRandomDue(
  app: App,
  settings: ReviewSettings,
  random: RandomSource = Math.random
): TFile | null {
  const due = getDueFiles(app, settings);
  const nowMs = Date.now();
  return pickTournamentWinner(
    due,
    (file) => {
      const interval = getEffectiveInterval(file, app, settings);
      if (interval === null) return Number.NEGATIVE_INFINITY;
      return getOverdueRatioScore(
        getLastReviewed(file, app, settings),
        interval,
        nowMs
      );
    },
    random
  );
}

export function countDue(app: App, settings: ReviewSettings): number {
  return getDueFiles(app, settings).length;
}
