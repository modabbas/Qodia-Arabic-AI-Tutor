export function codePreview(content: string) {
  const normalized = content.replace(/\r\n?/g, "\n").trimEnd();
  if (!normalized.trim()) return { preview: "", line_count: 0 };
  const lines = normalized.split("\n");
  const preview = lines.slice(0, 4).map(line => line.length > 180 ? `${line.slice(0, 180)}...` : line).join("\n");
  return { preview: `${preview}${lines.length > 4 ? "\n..." : ""}`, line_count: lines.length };
}

function calendarDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Damascus", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find(value => value.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"));
}

export function snippetDay(firstSavedAt: Date, savedAt: Date) {
  return Math.max(1, Math.round((calendarDay(savedAt) - calendarDay(firstSavedAt)) / 86_400_000) + 1);
}