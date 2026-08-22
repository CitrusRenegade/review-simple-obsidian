export type ReviewDetailsActionOutcome = "close" | "keep-open";

export async function runReviewDetailsAction(
  markReviewed: () => Promise<boolean>,
  closePopup: () => void
): Promise<ReviewDetailsActionOutcome> {
  try {
    if (!(await markReviewed())) return "keep-open";

    closePopup();
    return "close";
  } catch {
    return "keep-open";
  }
}
