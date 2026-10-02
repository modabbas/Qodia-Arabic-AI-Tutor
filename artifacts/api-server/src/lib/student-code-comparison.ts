import type { CodeDiffResult, CodeDiffLine } from "@workspace/api-zod";

// Check input is NOT a rewritten solution. Parsers already accept harmless
// whitespace; preserving indentation/literals prevents "repairing" real errors.
export function normalizeForChecks(code: string): string {
  return code.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

// Used only for comparison, never for storage, execution or semantic assessment.
// Keep quoted text (including multiline strings) verbatim.
function comparisonText(code: string): string {
  const parts = normalizeForChecks(code).split(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g);
  return parts.map((part, index) => index % 2 ? part : part
    .replace(/[ \t]+/g, " ")
    .replace(/ *([:,()[\]{};]) */g, "$1")
    .replace(/^ +| +$/gm, "")).join("");
}

export function normalizeForComparison(code: string): string {
  return comparisonText(code).replace(/\n{3,}/g, "\n\n").trim();
}

function comparisonLines(code: string, indentationMatters: boolean): string[] {
  const levels = [0];
  const normalized = comparisonText(code).split("\n");
  return normalizeForChecks(code).split("\n").map((line, index) => {
    if (!line.trim()) return "";
    const prefix = /^[ \t]*/.exec(line)![0];
    let width = 0;
    for (const char of prefix) width = char === "\t" ? width + (8 - width % 8) : width + 1;
    while (levels.length > 1 && width < levels[levels.length - 1]) levels.pop();
    if (width > levels[levels.length - 1]) levels.push(width);
    return `${indentationMatters ? levels.length - 1 : ""}|${normalized[index]}`;
  });
}

type Change = { student?: number; reference?: number };

// Bounded LCS for short lessons; a bounded lookahead for large existing files.
function align(student: string[], reference: string[]): Change[] {
  const out: Change[] = [];
  let i = 0; let j = 0;
  if (student.length * reference.length <= 160_000) {
    const grid = Array.from({ length: student.length + 1 }, () => new Uint16Array(reference.length + 1));
    for (let a = student.length - 1; a >= 0; a--) for (let b = reference.length - 1; b >= 0; b--) {
      grid[a][b] = student[a] === reference[b] ? grid[a + 1][b + 1] + 1 : Math.max(grid[a + 1][b], grid[a][b + 1]);
    }
    while (i < student.length || j < reference.length) {
      if (i < student.length && j < reference.length && student[i] === reference[j]) out.push({ student: i++, reference: j++ });
      else if (j < reference.length && (i === student.length || grid[i][j + 1] > grid[i + 1][j])) out.push({ reference: j++ });
      else out.push({ student: i++ });
    }
  } else {
    while (i < student.length || j < reference.length) {
      if (i < student.length && j < reference.length && student[i] === reference[j]) out.push({ student: i++, reference: j++ });
      else {
        const nextStudent = student.slice(i + 1, i + 21).indexOf(reference[j]);
        const nextRef = reference.slice(j + 1, j + 21).indexOf(student[i]);
        if (j < reference.length && (i >= student.length || nextRef >= 0 && (nextStudent < 0 || nextRef < nextStudent))) out.push({ reference: j++ });
        else if (i < student.length) out.push({ student: i++ });
        else out.push({ reference: j++ });
      }
    }
  }
  // Pair adjacent removals/additions into a single mismatched student line.
  for (let n = 0; n + 1 < out.length; n++) {
    const a = out[n]; const b = out[n + 1];
    if (a.student !== undefined && a.reference === undefined && b.student === undefined && b.reference !== undefined) {
      a.reference = b.reference; out.splice(n + 1, 1);
    } else if (a.student === undefined && a.reference !== undefined && b.student !== undefined && b.reference === undefined) {
      a.student = b.student; out.splice(n + 1, 1);
    }
  }
  return out;
}

export function codeDiff(
  code: string, reference: string, targetFile: string, reason: string, errorLine?: number,
  publicKeywords: string[] = [],
): CodeDiffResult {
  const raw = normalizeForChecks(code).split("\n");
  const indent = /\.(?:py|ya?ml)$/i.test(targetFile);
  const student = comparisonLines(code, indent);
  const expected = comparisonLines(reference || code, indent);
  const referenceRows = normalizeForChecks(reference || code).split("\n");
  const changes = align(student, expected);
  let lastNumber = 0;
  const rows: CodeDiffLine[] = changes.map(change => {
    const number = change.student !== undefined ? change.student + 1 : Math.min(raw.length + 1, lastNumber + 1);
    if (change.student !== undefined) lastNumber = number;
    const isError = number === errorLine && change.student !== undefined;
    const expectedField = change.reference === undefined ? undefined
      : /^\s*([A-Za-z_][A-Za-z0-9_-]*)\s*:/.exec(referenceRows[change.reference])?.[1];
    // Name only requirements already exposed in the lesson; no private values,
    // expressions or full reference-solution lines are returned.
    const publicField = expectedField && publicKeywords.some(keyword =>
      keyword.toLowerCase().includes(expectedField.toLowerCase())) ? expectedField : undefined;
    const status = change.student === undefined ? "missing" : change.reference === undefined ? "extra"
      : !isError && student[change.student] === expected[change.reference] ? "match" : "mismatch";
    return {
      lineNumber: number, studentContent: change.student === undefined ? "" : raw[change.student],
      status,
      ...(isError ? { hint: reason } : status === "missing"
        ? { hint: publicField ? `ناقص هون: عنصر ${publicField} المطلوب بالمهمة.`
          : "ناقص هون: راجع الجزء المطلوب بالمهمة أو كود البداية." }
        : status !== "match" ? { hint: "هالسطر مختلف عن النمط المتوقع؛ راجع الصياغة والمطلوب، مو ترتيب الحل حرفياً." } : {}),
    };
  });
  // A syntax failure with no useful reference still has an actionable location.
  if (!rows.some(row => row.status !== "match")) {
    const row = rows[Math.min(rows.length - 1, Math.max(0, (errorLine ?? raw.length) - 1))];
    if (row) { row.status = "mismatch"; row.hint = reason; }
  }
  const visible = rows.filter((row, index) => row.status !== "match"
    || rows[index - 1]?.status !== undefined && rows[index - 1].status !== "match"
    || rows[index + 1]?.status !== undefined && rows[index + 1].status !== "match");
  const result = visible.slice(0, 80);
  // Keep the native parser's exact problem even when the compact diff is capped.
  const exact = rows.find(row => row.lineNumber === errorLine && row.hint === reason);
  if (exact && !result.includes(exact)) result[result.length - 1] = exact;
  return { lines: result, truncated: visible.length > result.length };
}