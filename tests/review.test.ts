import { describe, expect, it } from "vitest";
import {
  getOverdueRatioScore,
  NEVER_REVIEWED_RANDOM_SCORE,
  pickTournamentWinner,
} from "../src/review";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW_MS = Date.UTC(2026, 0, 31);

function daysAgo(days: number): Date {
  return new Date(NOW_MS - days * DAY_MS);
}

function randomSequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
}

describe("pickTournamentWinner", () => {
  it("returns null when no notes are due", () => {
    expect(pickTournamentWinner([], () => 0)).toBeNull();
  });

  it("returns the only due note when there is one", () => {
    expect(pickTournamentWinner(["only"], () => 0)).toBe("only");
  });

  it("samples two distinct candidates for tournament selection", () => {
    const scored: string[] = [];
    const result = pickTournamentWinner(
      ["a", "b", "c"],
      (item) => {
        scored.push(item);
        return item === "b" ? 2 : 1;
      },
      randomSequence(0, 0)
    );

    expect(result).toBe("b");
    expect(scored).toHaveLength(2);
    expect(new Set(scored)).toEqual(new Set(["a", "b"]));
  });

  it("returns the candidate with the higher overdue ratio", () => {
    const result = pickTournamentWinner(
      [
        { id: "barely-due", reviewed: daysAgo(31), interval: 30 },
        { id: "stale", reviewed: daysAgo(90), interval: 30 },
      ],
      (item) => getOverdueRatioScore(item.reviewed, item.interval, NOW_MS),
      randomSequence(0, 0)
    );

    expect(result?.id).toBe("stale");
  });

  it("prefers a stale weekly note over a barely stale yearly note", () => {
    const result = pickTournamentWinner(
      [
        { id: "yearly", reviewed: daysAgo(395), interval: 365 },
        { id: "weekly", reviewed: daysAgo(21), interval: 7 },
      ],
      (item) => getOverdueRatioScore(item.reviewed, item.interval, NOW_MS),
      randomSequence(0, 0)
    );

    expect(result?.id).toBe("weekly");
  });

  it("scores never-reviewed notes moderately above barely-due notes", () => {
    expect(getOverdueRatioScore(null, 30, NOW_MS)).toBe(
      NEVER_REVIEWED_RANDOM_SCORE
    );

    const neverBeatsBarelyDue = pickTournamentWinner(
      [
        { id: "never", reviewed: null, interval: 30 },
        { id: "barely-due", reviewed: daysAgo(31), interval: 30 },
      ],
      (item) => getOverdueRatioScore(item.reviewed, item.interval, NOW_MS),
      randomSequence(0, 0)
    );
    const staleBeatsNever = pickTournamentWinner(
      [
        { id: "never", reviewed: null, interval: 30 },
        { id: "stale", reviewed: daysAgo(90), interval: 30 },
      ],
      (item) => getOverdueRatioScore(item.reviewed, item.interval, NOW_MS),
      randomSequence(0, 0)
    );

    expect(neverBeatsBarelyDue?.id).toBe("never");
    expect(staleBeatsNever?.id).toBe("stale");
  });

  it("returns one candidate when tournament scores are equal", () => {
    const result = pickTournamentWinner(["a", "b"], () => 1, randomSequence(0, 0));

    expect(["a", "b"]).toContain(result);
  });
});
