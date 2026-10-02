import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extname } from "node:path";
import { transform } from "esbuild";
import { parseDocument } from "yaml";

export type Check = { pass: boolean; reason?: string; lineNumber?: number };

// A lexer, not a compiler: comments/quoted text cannot masquerade as executable
// widget structure. Preserve offsets so balanced-call inspection stays safe.
export function codeEvidence(code: string, python = false, keepStrings = false, javascript = false): string {
  let result = "";
  for (let i = 0; i < code.length;) {
    if (code.startsWith("//", i) || (python && code[i] === "#")) {
      const end = code.indexOf("\n", i);
      const next = end < 0 ? code.length : end;
      result += " ".repeat(next - i); i = next;
    } else if (code.startsWith("/*", i)) {
      const end = code.indexOf("*/", i + 2);
      if (end < 0) throw Object.assign(new Error("unterminated_comment"), { lineNumber: code.slice(0, i).split("\n").length });
      const next = end < 0 ? code.length : end + 2;
      result += code.slice(i, next).replace(/[^\n]/g, " "); i = next;
    } else if (javascript && code[i] === "/" &&
      /(?:^|[=(:,!;\[{}?]|\b(?:return|case|throw)|=>)\s*$/.test(code.slice(Math.max(0, i - 50), i))) {
      const start = i++;
      let inClass = false;
      while (i < code.length) {
        if (code[i] === "\\") { i += 2; continue; }
        if (code[i] === "[") inClass = true;
        if (code[i] === "]") inClass = false;
        if (code[i] === "/" && !inClass) { i++; break; }
        i++;
      }
      while (/[a-z]/i.test(code[i] ?? "") && i < code.length) i++;
      const text = code.slice(start, i);
      result += keepStrings ? text : text.replace(/[^\n]/g, " ");
    } else if (["\"", "'", "`"].includes(code[i])) {
      const quote = code[i];
      const delimiter = python && code.startsWith(quote.repeat(3), i) ? quote.repeat(3) : quote;
      const start = i; i += delimiter.length;
      let closed = false;
      while (i < code.length) {
        if (code[i] === "\\") { i += 2; continue; }
        if (code.startsWith(delimiter, i)) { i += delimiter.length; closed = true; break; }
        i++;
      }
      if (!closed) throw Object.assign(new Error("unterminated_string"), { lineNumber: code.slice(0, start).split("\n").length });
      const text = code.slice(start, i);
      result += keepStrings ? text : text.replace(/[^\n]/g, " ");
    } else { result += code[i]; i++; }
  }
  return result;
}

function balanced(code: string): Check {
  const stack: { char: string; line: number }[] = [];
  let line = 1;
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  for (const character of code) {
    if (character === "\n") line++;
    if ("([{".includes(character)) stack.push({ char: character, line });
    else if (")]}".includes(character) && stack.pop()?.char !== pairs[character]) {
      return { pass: false, lineNumber: line, reason: "الأقواس مو متوازنة أو ترتيبها مو صحيح. راجع مكان فتحها وإغلاقها." };
    }
  }
  return stack.length ? { pass: false, lineNumber: stack[stack.length - 1].line, reason: "في قوس مفتوح لسه ما سكّرته. راجع الأقواس وجرب مرة ثانية." } : { pass: true };
}

export async function syntaxCheck(code: string, techStack: string, targetFile: string): Promise<Check> {
  if (code.trim().length < 10) return { pass: false, reason: "الكود قصير جداً. اكتب حل المهمة قبل ما نتفحصه." };
  const extension = extname(targetFile).toLowerCase();
  try {
    if (extension === ".yaml" || extension === ".yml") {
      const document = parseDocument(code, { uniqueKeys: true });
      if (document.errors.length) return { pass: false,
        lineNumber: code.slice(0, document.errors[0].pos[0]).split("\n").length,
        reason: "صياغة YAML مو جاهزة. راجع المسافات والنقطتين بعد أسماء الحقول." };
      const data: unknown = document.toJS({ maxAliasCount: 20 });
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { pass: false, reason: "ملف الإعدادات يحتاج حقول وقيم فعلية، مو قائمة كلمات." };
      }
      return { pass: true };
    }
    if (extension === ".json") {
      const data: unknown = JSON.parse(code);
      return data && typeof data === "object" ? { pass: true } :
        { pass: false, reason: "اكتب إعدادات JSON فعلية ضمن كائن أو قائمة." };
    }
    const evidence = codeEvidence(code, techStack === "Django", false, ["React", "Node.js"].includes(techStack));
    if (!evidence.trim()) return { pass: false, reason: "التعليقات لحالها مو حل. أضف الكود اللي ينفّذ المهمة." };
    if (extension === ".py" || techStack === "Django") {
      // Parse only. Never execute, import, or compile student programs.
      await promisify(execFile)("python3", ["-I", "-c",
        "import ast,sys; ast.parse(sys.argv[1])", code], { timeout: 1000, maxBuffer: 4096 });
      if (!/\b(?:def|class|return|import|from|if|for|while|with|raise|assert)\b|=|\w\s*\(/.test(evidence)) {
        return { pass: false, reason: "استخدم الكلمات ضمن تعليمة أو دالة فعلية، مو كأسماء منفصلة." };
      }
      return { pass: true };
    }
    const brackets = balanced(evidence);
    if (!brackets.pass) return brackets;
    if ([".js", ".jsx", ".ts", ".tsx", ".css"].includes(extension) || ["React", "Node.js"].includes(techStack)) {
      const loader = [".js", ".jsx", ".ts", ".tsx", ".css"].includes(extension)
        ? extension.slice(1) as "js" | "jsx" | "ts" | "tsx" | "css"
        : techStack === "React" ? "jsx" : "js";
      await transform(code, { loader, logLevel: "silent" });
      if (loader !== "css" && !/\b(?:const|let|var|function|class|return|import|export|if|for|while)\b|=>|=|\w\s*\(|<[A-Za-z]/.test(evidence)) {
        return { pass: false, reason: "الكلمات لحالها ما بتنفّذ المهمة. اكتب تعليمة أو استدعاء فعلي." };
      }
      return { pass: true };
    }
    // Dart permits a widget expression without a surrounding application.
    // These are bounded preflight checks, not flutter analyze/build.
    if (!/\w\s*(?:<[^;{}]*>)?\s*\(/.test(evidence)) {
      return { pass: false, reason: "لازم تستخدم دالة أو widget فعلياً مع أقواس، مو بس تذكر اسمه." };
    }
    if (/(?:\b(?:final|var|int|double|bool|String)\s+\w+\s*=\s*[^;\n{}]+$)|(?:\bimport\s+[^;\n]+$)/m.test(codeEvidence(code, false, true))
      || /\breturn\b[^;{}]*}\s*$/s.test(evidence)) {
      return { pass: false, reason: "راجع الفاصلة المنقوطة ; بعد التعليمات، خصوصاً تعريف المتغيّر أو return." };
    }
    if (/=\s*;|,\s*,/.test(evidence)) return { pass: false, reason: "في تعليمة ناقصة. راجع القيم والفواصل بالمقطع اللي كتبته." };
    return { pass: true };
  } catch (error) {
    const details = error as { stderr?: string; message?: string; lineNumber?: number; errors?: { location?: { line?: number } }[] };
    const pythonLine = /line (\d+)/.exec(details.stderr ?? "");
    return { pass: false, lineNumber: details.lineNumber ?? details.errors?.[0]?.location?.line
      ?? (pythonLine ? Number(pythonLine[1]) : undefined), reason: details.message === "unterminated_string"
      ? "النص بهالسطر مفتوح. سكّر علامة الاقتباس اللي بدأت فيها."
      : details.message === "unterminated_comment"
      ? "التعليق بهالسطر مفتوح. سكّره بعلامة */."
      : techStack === "Django"
      ? "الصياغة مو جاهزة. راجع المسافات البادئة والنقطتين : والأقواس."
      : "الصياغة مو جاهزة. راجع التعريفات والأقواس والقيم الناقصة وجرب من جديد." };
  }
}