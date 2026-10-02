export type LiveSyntaxIssue = { lineNumber: number; hint: string };

// A bounded, non-blocking lexer. This is deliberately not a compiler or a
// semantic verdict; complete syntax/structure checks still happen on submit.
export function liveSyntaxIssues(code: string, targetFile: string): LiveSyntaxIssue[] {
  if (!code.trim() || code.length > 100_000) return [];
  const python = /\.py$/i.test(targetFile);
  const yaml = /\.ya?ml$/i.test(targetFile);
  const js = /\.[cm]?[jt]sx?$/i.test(targetFile);
  const rows = code.replace(/\r\n?/g, "\n").split("\n");
  const issues = new Map<number, string>();
  const brackets: { char: string; line: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  let quote = ""; let quoteLine = 0; let blockComment = false;
  let needsIndent: number | null = null; const levels = [0];
  let scalarIndent: number | null = null;
  for (let index = 0; index < rows.length; index++) {
    const lineNumber = index + 1; const row = rows[index];
    const prefix = /^[ \t]*/.exec(row)![0];
    let width = 0;
    for (const char of prefix) width = char === "\t" ? width + 8 - width % 8 : width + 1;
    const content = row.slice(prefix.length);
    if (!content || (python || yaml) && content.startsWith("#")) continue;
    if (yaml && scalarIndent !== null) {
      if (width > scalarIndent) continue;
      scalarIndent = null;
    }
    if ((python || yaml) && !quote && !brackets.length) {
      if (yaml && prefix.includes("\t")) issues.set(lineNumber, "YAML يحتاج مسافات للبداية، مو tab.");
      if (needsIndent !== null && width <= needsIndent) issues.set(lineNumber, "هالسطر يحتاج يدخل ضمن البلوك السابق.");
      needsIndent = null;
      if (width < levels[levels.length - 1]) {
        while (levels.length > 1 && width < levels[levels.length - 1]) levels.pop();
        if (width !== levels[levels.length - 1]) issues.set(lineNumber, "المسافة البادئة ما بتطابق مستوى سابق. راجع البلوك.");
      }
      if (width > levels[levels.length - 1]) levels.push(width);
    }
    if (yaml && /:\s*[|>][+-]?\d?\s*(?:#.*)?$/.test(content)) { scalarIndent = width; continue; }
    // Plain YAML scalars can contain apostrophes/brackets literally.
    if (yaml && !quote && !brackets.length) {
      const value = content.replace(/^(?:[^:]+:\s*|-\s*)/, "").trim();
      if (!/^["'[{]/.test(value)) continue;
    }
    let evidence = "";
    for (let cursor = 0; cursor < row.length; cursor++) {
      const char = row[cursor]; const rest = row.slice(cursor);
      if (blockComment) { if (rest.startsWith("*/")) { blockComment = false; cursor++; } continue; }
      if (quote) {
        if (char === "\\") { cursor++; continue; }
        if (rest.startsWith(quote)) { cursor += quote.length - 1; quote = ""; }
        continue;
      }
      if ((python || yaml) && char === "#" || !python && !yaml && rest.startsWith("//")) break;
      if (!python && !yaml && rest.startsWith("/*")) { blockComment = true; cursor++; continue; }
      if (js && char === "/" && /(?:^|[=(:,!;\[{}?]|\b(?:return|case|throw)|=>)\s*$/.test(evidence)) {
        let inClass = false;
        for (cursor++; cursor < row.length; cursor++) {
          if (row[cursor] === "\\") { cursor++; continue; }
          if (row[cursor] === "[") inClass = true;
          if (row[cursor] === "]") inClass = false;
          if (row[cursor] === "/" && !inClass) break;
        }
        continue;
      }
      if (char === '"' || char === "'" || char === "`" && !python && !yaml) {
        quote = python && rest.startsWith(char.repeat(3)) ? char.repeat(3) : char;
        quoteLine = lineNumber; cursor += quote.length - 1; continue;
      }
      evidence += char;
      if ("([{".includes(char)) brackets.push({ char, line: lineNumber });
      else if (pairs[char] && brackets.pop()?.char !== pairs[char]) issues.set(lineNumber, "راجع القوس: نوع الإغلاق أو ترتيبه مختلف.");
    }
    if (quote && quote.length === 1 && quote !== "`" && !row.endsWith("\\") && !yaml) {
      issues.set(quoteLine, "علامة الاقتباس مفتوحة. راجع إغلاق النص."); quote = "";
    }
    if (python && !quote && !brackets.length && /:\s*$/.test(evidence)) needsIndent = width;
  }
  if (quote) issues.set(quoteLine, "في نص مفتوح يحتاج علامة إغلاق.");
  for (const bracket of brackets) issues.set(bracket.line, "في قوس مفتوح يحتاج إغلاق.");
  return [...issues].map(([lineNumber, hint]) => ({ lineNumber, hint })).slice(0, 20);
}