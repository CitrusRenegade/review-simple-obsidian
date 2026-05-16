function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function setStringFrontmatter(
  frontmatter: unknown,
  key: string,
  value: string
): void {
  if (!isRecord(frontmatter)) return;
  frontmatter[key] = value;
}
