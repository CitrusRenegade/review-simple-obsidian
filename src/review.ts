import { App, TFile } from "obsidian";
import { FolderInterval, ReviewSettings } from "./settings";

function getFrontmatter(file: TFile, app: App): Record<string, unknown> {
  return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
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
  const d = new Date(String(val));
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
  return Date.now() - last.getTime() > interval * 24 * 60 * 60 * 1000;
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
  settings: ReviewSettings
): TFile | null {
  const due = getDueFiles(app, settings);
  if (due.length === 0) return null;
  return due[Math.floor(Math.random() * due.length)];
}

export function countDue(app: App, settings: ReviewSettings): number {
  return getDueFiles(app, settings).length;
}
