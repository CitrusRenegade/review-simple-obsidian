import type { TFile } from "obsidian";

export class ReviewedDayOverrides {
  private readonly values = new Map<
    TFile,
    { frontmatterKey: string; reviewedDay: string }
  >();

  get(file: TFile, frontmatterKey: string): string | null {
    const value = this.values.get(file);
    if (!value) return null;
    if (value.frontmatterKey !== frontmatterKey) {
      this.values.delete(file);
      return null;
    }
    return value.reviewedDay;
  }

  set(file: TFile, frontmatterKey: string, reviewedDay: string): void {
    this.values.set(file, { frontmatterKey, reviewedDay });
  }

  delete(file: TFile): void {
    this.values.delete(file);
  }

  rollback(
    file: TFile,
    frontmatterKey: string,
    previousReviewedDay: string | null,
    currentFile: TFile | null
  ): boolean {
    if (currentFile !== file) {
      this.values.delete(file);
      return false;
    }

    if (previousReviewedDay === null) {
      this.values.delete(file);
    } else {
      this.values.set(file, { frontmatterKey, reviewedDay: previousReviewedDay });
    }
    return true;
  }
}
