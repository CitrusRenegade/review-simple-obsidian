export function parsePositiveDayCount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;

  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
