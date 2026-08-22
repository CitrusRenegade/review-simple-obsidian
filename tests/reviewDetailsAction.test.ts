import { describe, expect, it } from "vitest";
import { runReviewDetailsAction } from "../src/reviewDetailsAction";

describe("runReviewDetailsAction", () => {
  it("closes the popup only after the note is marked successfully", async () => {
    let finishMarking!: (success: boolean) => void;
    let closeCount = 0;
    const action = runReviewDetailsAction(
      () =>
        new Promise<boolean>((resolve) => {
          finishMarking = resolve;
        }),
      () => {
        closeCount += 1;
      }
    );

    expect(closeCount).toBe(0);
    finishMarking(true);
    expect(await action).toBe("close");
    expect(closeCount).toBe(1);
  });

  it("does not close the popup when marking fails", async () => {
    let closeCount = 0;
    expect(
      await runReviewDetailsAction(async () => false, () => {
        closeCount += 1;
      })
    ).toBe("keep-open");
    expect(closeCount).toBe(0);
  });

  it("keeps the popup open when marking throws", async () => {
    expect(
      await runReviewDetailsAction(
        async () => {
          throw new Error("write failed");
        },
        () => {
          throw new Error("must not close");
        }
      )
    ).toBe("keep-open");
  });
});
