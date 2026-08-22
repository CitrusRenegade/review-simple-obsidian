export type RenamedReviewTargetKind = "file" | "folder" | "other";

export function shouldRefreshActiveReviewAfterRename(
  targetKind: RenamedReviewTargetKind,
  renamedFileIsActive: boolean
): boolean {
  return targetKind === "folder" || (targetKind === "file" && renamedFileIsActive);
}
