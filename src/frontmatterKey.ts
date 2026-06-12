export function isValidFrontmatterKey(value: string): boolean {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return false;
  return !["__proto__", "constructor", "prototype"].includes(trimmed);
}
