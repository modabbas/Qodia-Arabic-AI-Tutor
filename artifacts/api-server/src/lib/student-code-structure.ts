import { codeEvidence, type Check } from "./student-code-syntax.ts";
import { parseDocument } from "yaml";
import { normalizeForComparison } from "./student-code-comparison.ts";

export type BuildTask = {
  task_description: string;
  starter_code: string;
  expected_keywords: string[];
  target_file: string;
  existing_content: string;
  reference_solution?: string;
  validation?: {
    level2_rules: { pattern: string; error_if_missing: string }[];
    level3_question: string;
  };
};

// Accept only a tiny, linear-time pattern grammar. Never execute arbitrary
// model-generated regexes (nested quantifiers/lookarounds can freeze a server).
export function safeStructurePattern(pattern: string): RegExp | null {
  if (pattern.length > 160) return null;
  const match = /^(?:\\b)?([A-Za-z_][A-Za-z0-9_.]*)(\\s\*(?:\[<\(\]|\[<\(\[]|:|\\\(|=))?$/.exec(pattern);
  if (!match) return null;
  const identifier = match[1].replace(/\./g, "\\.");
  return new RegExp(`\\b${identifier}${match[2] ?? "\\b"}`);
}

function widgetBody(code: string, name: string): string | null {
  const start = new RegExp(`\\b${name}\\s*(?:<[^;{}]*>)?\\s*\\(`).exec(code);
  if (!start) return null;
  const open = start.index + start[0].length - 1;
  let depth = 1;
  for (let i = open + 1; i < code.length; i++) {
    if (code[i] === "(") depth++;
    if (code[i] === ")" && --depth === 0) return code.slice(open + 1, i);
  }
  return null;
}

export function structureCheck(code: string, concept: string, task: BuildTask, techStack: string): Check {
  const yaml = /\.ya?ml$/i.test(task.target_file);
  const json = /\.json$/i.test(task.target_file);
  const javascript = ["React", "Node.js"].includes(techStack);
  const evidence = yaml || json ? code.replace(/(^|\n)[ \t]*#[^\n]*/g, "$1")
    : codeEvidence(code, techStack === "Django", false, javascript);
  const stringsAllowed = (yaml ? JSON.stringify(parseDocument(code).toJS({ maxAliasCount: 20 }))
    : json ? JSON.stringify(JSON.parse(code))
    : codeEvidence(code, techStack === "Django", true, javascript)).toLowerCase();
  const normalizedEvidence = normalizeForComparison(stringsAllowed);
  const missing = task.expected_keywords.filter((keyword) => {
    if (stringsAllowed.includes(keyword.toLowerCase())
      || normalizedEvidence.includes(normalizeForComparison(keyword.toLowerCase()))) return false;
    // A YAML key/value requirement must match parsed data, not a comment or an
    // exact spelling of spaces around ":".
    if (yaml && /^\s*[\w-]+\s*:/.test(keyword)) {
      try {
        const fragment = parseDocument(keyword).toJS({ maxAliasCount: 20 });
        if (fragment && typeof fragment === "object" && !Array.isArray(fragment)) {
          return !Object.entries(fragment).every(([key, value]) =>
            stringsAllowed.includes(`${JSON.stringify(key).toLowerCase()}:${JSON.stringify(value).toLowerCase()}`));
        }
      } catch { /* normal mandatory keyword check below */ }
    }
    return true;
  });
  if (missing.length) return { pass: false, reason: `قريب! تأكد من تطبيق العناصر المطلوبة: ${missing.join("، ")}. راجع كود البداية.` };
  for (const widget of ["StreamBuilder", "FutureBuilder"]) {
    if (!`${concept} ${task.expected_keywords.join(" ")}`.includes(widget)) continue;
    const body = widgetBody(evidence, widget);
    if (body === null) return { pass: false, reason: `${widget} لازم يكون مستخدم كـ widget مع أقواس، مو بس مذكور بالنص.` };
    const parameter = widget === "StreamBuilder" ? "stream" : "future";
    if (!new RegExp(`\\b${parameter}\\s*:`).test(body)) return { pass: false, reason: `${widget} يحتاج parameter اسمه ${parameter}.` };
    if (!/\bbuilder\s*:/.test(body)) return { pass: false, reason: `${widget} يحتاج parameter اسمه builder يبني الواجهة.` };
  }
  for (const rule of task.validation?.level2_rules ?? []) {
    const pattern = safeStructurePattern(rule.pattern);
    // Unsupported patterns are skipped; the native checks and keyword fallback
    // remain mandatory. Generation instructs Gemini to use this safe grammar.
    if (pattern && !pattern.test(evidence)) {
      return { pass: false, reason: /[\u0600-\u06ff]/.test(rule.error_if_missing)
        ? rule.error_if_missing : "في جزء من بنية الحل ناقص. راجع كود البداية والمعاملات المطلوبة." };
    }
  }
  return { pass: true };
}