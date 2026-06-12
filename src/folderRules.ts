import type { FolderInterval } from "./settings";

interface FolderReviewRuleSettings {
  excludedFolders: string[];
  includedFolders: string[];
  folderIntervals: FolderInterval[];
}

function normalizeFolderPath(path: string): string {
  return path.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
}

function migrateFolderPath(
  folderPath: string,
  oldFolderPath: string,
  newFolderPath: string
): string {
  if (folderPath === oldFolderPath) return newFolderPath;

  const oldPrefix = oldFolderPath + "/";
  if (folderPath.startsWith(oldPrefix)) {
    return newFolderPath + "/" + folderPath.slice(oldPrefix.length);
  }

  return folderPath;
}

export function migrateRenamedFolderReviewRules(
  settings: FolderReviewRuleSettings,
  oldPath: string,
  newPath: string
): boolean {
  const oldFolderPath = normalizeFolderPath(oldPath);
  const newFolderPath = normalizeFolderPath(newPath);
  if (!oldFolderPath || !newFolderPath || oldFolderPath === newFolderPath) {
    return false;
  }

  let changed = false;
  const migrate = (folderPath: string): string => {
    const migrated = migrateFolderPath(
      normalizeFolderPath(folderPath),
      oldFolderPath,
      newFolderPath
    );
    if (migrated !== folderPath) changed = true;
    return migrated;
  };

  const excludedFolders = settings.excludedFolders.map(migrate);
  const includedFolders = settings.includedFolders.map(migrate);
  const folderIntervals = settings.folderIntervals.map((rule) => {
    const folder = migrate(rule.folder);
    return folder === rule.folder ? rule : { ...rule, folder };
  });

  if (!changed) return false;

  settings.excludedFolders = excludedFolders;
  settings.includedFolders = includedFolders;
  settings.folderIntervals = folderIntervals;
  return true;
}
