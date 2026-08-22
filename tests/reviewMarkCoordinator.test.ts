import { describe, expect, it } from "vitest";
import { ReviewMarkCoordinator } from "../src/reviewMarkCoordinator";

describe("ReviewMarkCoordinator", () => {
  it("deduplicates overlapping marks and lets a command stop preserving details", async () => {
    const coordinator = new ReviewMarkCoordinator<object, string>();
    const file = {};
    let finishMarking!: (success: boolean) => void;
    let writeCount = 0;
    const first = coordinator.run(file, "reviewed", true, () => {
      writeCount += 1;
      return new Promise<boolean>((resolve) => {
        finishMarking = resolve;
      });
    });
    const second = coordinator.run(file, "reviewed", false, async () => {
      writeCount += 1;
      return true;
    });

    expect(writeCount).toBe(1);
    expect(coordinator.shouldPreserveDetails(file, "reviewed")).toBe(false);
    finishMarking(false);
    expect(await first).toBe(false);
    expect(await second).toBe(false);
  });

  it("clears failed work so a later mark can run normally", async () => {
    const coordinator = new ReviewMarkCoordinator<object, string>();
    const file = {};

    expect(
      await coordinator.run(file, "reviewed", true, async () => false)
    ).toBe(false);
    expect(coordinator.shouldPreserveDetails(file, "reviewed")).toBe(false);
    expect(
      await coordinator.run(file, "reviewed", false, async () => true)
    ).toBe(true);
  });

  it("tracks a renamed file by identity without capturing a replacement at its old path", async () => {
    const coordinator = new ReviewMarkCoordinator<
      { path: string },
      string
    >();
    const file = { path: "Projects/a.md" };
    let finishMarking!: (success: boolean) => void;
    let originalWriteCount = 0;
    const first = coordinator.run(file, "reviewed", true, () => {
      originalWriteCount += 1;
      return new Promise<boolean>((resolve) => {
        finishMarking = resolve;
      });
    });

    file.path = "Archive/a.md";
    const duplicate = coordinator.run(file, "reviewed", true, async () => {
      originalWriteCount += 1;
      return true;
    });
    const replacement = { path: "Projects/a.md" };
    const replacementResult = coordinator.run(
      replacement,
      "reviewed",
      false,
      async () => true
    );

    expect(originalWriteCount).toBe(1);
    expect(coordinator.shouldPreserveDetails(file, "reviewed")).toBe(true);
    expect(await replacementResult).toBe(true);
    finishMarking(true);
    expect(await first).toBe(true);
    expect(await duplicate).toBe(true);
  });

  it("queues a separate mark when the frontmatter key changes", async () => {
    const coordinator = new ReviewMarkCoordinator<object, string>();
    const file = {};
    let finishFirst!: (success: boolean) => void;
    const writes: string[] = [];
    const first = coordinator.run(file, "reviewed", true, () => {
      writes.push("reviewed");
      return new Promise<boolean>((resolve) => {
        finishFirst = resolve;
      });
    });
    const second = coordinator.run(file, "reviewed_at", true, async () => {
      writes.push("reviewed_at");
      return true;
    });

    expect(writes).toEqual(["reviewed"]);
    finishFirst(true);
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(writes).toEqual(["reviewed", "reviewed_at"]);
  });
});
