import type { App, TFile } from "obsidian";
import { parsePositiveDayCount } from "./interval";
import type { FolderInterval, ReviewSettings } from "./settings";

const DAY_MS = 24 * 60 * 60 * 1000;
export const NEVER_REVIEWED_RANDOM_SCORE = 1.5;

type RandomSource = () => number;

function parseDateOnly(value: string): Date | null | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

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

export function getCalendarDaysSince(
  lastReviewed: Date,
  now = new Date()
): number {
  const reviewedDay = Date.UTC(
    lastReviewed.getFullYear(),
    lastReviewed.getMonth(),
    lastReviewed.getDate()
  );
  const nowDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((nowDay - reviewedDay) / DAY_MS));
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
  return parsePositiveDayCount(val);
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

  if (isExcluded(file, settings)) return null;

  const folderInterval = getFolderInterval(file, settings);
  if (folderInterval !== null) return folderInterval;

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
  if (typeof val === "string") {
    const dateOnly = parseDateOnly(val);
    if (dateOnly !== undefined) return dateOnly;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function isDue(
  file: TFile,
  app: App,
  settings: ReviewSettings,
  now = new Date()
): boolean {
  const interval = getEffectiveInterval(file, app, settings);
  if (interval === null) return false;
  const last = getLastReviewed(file, app, settings);
  if (!last) return true;
  return getCalendarDaysSince(last, now) >= interval;
}

export function getReviewableFiles(
  app: App,
  settings: ReviewSettings
): TFile[] {
  return app.vault.getMarkdownFiles().filter((f) => {
    const local = getLocalInterval(f, app, settings);
    if (local === "never") return false;
    if (typeof local === "number") return true;
    if (isExcluded(f, settings)) return false;
    return true;
  });
}

export function getDueFiles(
  app: App,
  settings: ReviewSettings,
  now = new Date()
): TFile[] {
  return getReviewableFiles(app, settings).filter((f) =>
    isDue(f, app, settings, now)
  );
}

export function pickRandomDue(
  app: App,
  settings: ReviewSettings,
  random: RandomSource = Math.random
): TFile | null {
  const now = new Date();
  const due = getDueFiles(app, settings, now);
  const nowMs = now.getTime();
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
