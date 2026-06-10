import { describe, expect, it } from "vitest";
import { formatLocalDate } from "../src/dates";

describe("formatLocalDate", () => {
  it("formats using local date parts instead of UTC ISO date", () => {
    const date = new Date(2026, 5, 10, 1, 30);

    expect(formatLocalDate(date)).toBe("2026-06-10");
  });
});
