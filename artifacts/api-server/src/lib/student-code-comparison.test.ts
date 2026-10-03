import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import { codeDiff, normalizeForChecks, normalizeForComparison, syntaxErrorDiff } from "./student-code-comparison.ts";
import { syntaxCheck } from "./student-code-syntax.ts";
import { validateStudentCode } from "./student-code-validation.ts";

const req = { log: { info() {}, warn() {} } } as unknown as Pick<Request, "log">;
const assessment = async () => ({ is_valid: true, score: 92, feedback_ar: "حل صحيح.", suggestions: [] });
function input(code: string, reference: string, file: string, stack: string, keywords: string[] = []) {
  return { code, techStack: stack, concept: "Practice", task: {
    target_file: file, task_description: "Implement the task", starter_code: reference,
    existing_content: "", reference_solution: reference, expected_keywords: keywords,
  } };
}

test("comparison ignores benign spaces/blank lines but preserves literal whitespace", () => {
  assert.equal(normalizeForComparison("  fn(  x , y );  \n\n\n\n"), normalizeForComparison("fn(x,y);"));
  assert.notEqual(normalizeForComparison('const name = "New  York";'), normalizeForComparison('const name="New York";'));
  assert.equal(normalizeForChecks('const text = `a  \n b  `;\r\n'), 'const text = `a  \n b  `;\n');
  const diff = codeDiff('const t = `hello\n two  spaces`;', 'const t = `hello\n two spaces`;', "a.js", "راجع النص.");
  assert.ok(diff.lines.some(line => line.lineNumber === 2 && line.status !== "match"));
});

test("YAML two/four spaces and harmless colon spacing pass every existing level", async () => {
  const reference = "dependencies:\n  flutter:\n    sdk: flutter\n  provider: ^6.1.0\n";
  for (const code of [reference + "   \n\n\n", "dependencies:\n    flutter:\n        sdk: flutter\n    provider :    ^6.1.0  \n"]) {
    const result = await validateStudentCode(input(code, reference, "pubspec.yaml", "Flutter", ["provider: ^6.1.0", "sdk: flutter"]), req, assessment);
    assert.equal(result.valid, true);
    assert.equal(result.level, 3);
  }
  // Comparison is not an acceptance gate and ignores nesting width, not depth.
  const hierarchy = codeDiff("dependencies:\n    flutter:\n        sdk: flutter\n    provider: ^6.1.0", reference.trimEnd(), "pubspec.yaml", "خطأ.", 1);
  assert.ok(hierarchy.lines.filter(line => line.lineNumber !== 1).every(line => line.status === "match"));
});

test("consistent Python tabs/spaces pass; incorrect indentation is never repaired", async () => {
  const reference = "def flights():\n    return []\n";
  for (const code of ["def flights():   \n    return []   \n\n", "def flights():\n\treturn []\n"]) {
    assert.equal((await validateStudentCode(input(code, reference, "flights.py", "Django"), req, assessment)).valid, true);
  }
  for (const code of ["def flights():\nreturn []", "def flights():\n    count = 1\n  return []",
    "def flights():\n\tcount = 1\n        return []"]) {
    let called = false;
    const result = await validateStudentCode(input(code, reference, "flights.py", "Django"), req,
      async () => { called = true; return assessment(); });
    assert.equal(result.valid, false);
    assert.equal(result.level, 1);
    assert.equal(called, false);
    assert.ok(result.diff?.lines.some(line => line.status !== "match"));
  }
});

test("alternative valid code is accepted rather than compared to an exact solution", async () => {
  const code = "const total = [1, 2].reduce((sum, value) => sum + value, 0);";
  const result = await validateStudentCode(input(code, "const total = 3;", "index.js", "Node.js"), req, assessment);
  assert.equal(result.valid, true);
  assert.equal(result.diff, undefined);
});

test("diff keeps exact native error, context, inserted/missing lines and no reference solution leak", async () => {
  const reference = "const alpha = 1;\nconst secretAnswer = alpha + 2;\nconst done = true;";
  const diff = codeDiff("const alpha = 1;\nconst done = true;", reference, "a.js", "في جزء ناقص.");
  assert.ok(diff.lines.some(line => line.status === "missing" && line.lineNumber === 2));
  assert.ok(!JSON.stringify(diff).includes("secretAnswer"));
  assert.ok(diff.lines.some(line => line.status === "match"));
  const mismatch = codeDiff("const alpha = 1;\nconst z = );\nconst done = true;", reference, "a.js", "راجع قوس الإغلاق.", 2);
  assert.ok(mismatch.lines.some(line => line.lineNumber === 2 && line.hint === "راجع قوس الإغلاق."));
  const parsed = await syntaxCheck("const a = 1;\nconst b = (];", "Node.js", "a.js");
  assert.equal(parsed.lineNumber, 2);
  const quote = await syntaxCheck("const a = 1;\nconst b = 'oops;\nconst c = 3;", "Node.js", "a.js");
  assert.equal(quote.lineNumber, 2);
});

test("large comparisons are bounded and retain an exact late error location", () => {
  const code = Array.from({ length: 1000 }, (_, n) => `const var${n} = ${n};`).join("\n");
  const result = codeDiff(code, "const other = 1;", "a.js", "راجع هالسطر.", 999);
  assert.ok(result.lines.length <= 80);
  assert.ok(result.truncated);
  assert.ok(result.lines.some(line => line.lineNumber === 999 && line.hint === "راجع هالسطر."));
});

test("one unclosed parenthesis produces one diagnostic at its opening, not missing-reference boxes", async () => {
  const code = "const setup = true;\nconst value = call(\n  42,\n  setup\n;\nconst after = 1;\nconst last = 2;";
  const reference = "const setup = true;\nconst value = call(42, setup);\nconst after = 1;\nconst last = 2;";
  const result = await validateStudentCode(input(code, reference, "a.js", "Node.js"), req, assessment);
  assert.equal(result.level, 1);
  assert.equal(result.valid, false);
  const diagnostics = result.diff!.lines.filter(row => row.hint);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].lineNumber, 2);
  assert.ok(diagnostics[0].hint!.includes("الحرف 19"));
  assert.ok(diagnostics[0].hint!.includes("«(»"));
  assert.ok(!result.diff!.lines.some(row => row.status === "missing" || row.status === "extra"));
  assert.ok(!JSON.stringify(result.diff).includes("ناقص هون"));
});

test("nested bracket mismatch points to its opening; unexpected closing bracket points to itself", async () => {
  const mismatch = await syntaxCheck("const value = call(\n  42\n];", "Node.js", "a.js");
  assert.equal(mismatch.lineNumber, 1);
  assert.equal(mismatch.columnNumber, 19);
  const extra = await syntaxCheck("const value = 42;\n);", "Node.js", "a.js");
  assert.equal(extra.lineNumber, 2);
  assert.equal(extra.columnNumber, 1);
});

test("quoted/comment brackets stay ignored and native syntax locations include the character", async () => {
  assert.equal((await syntaxCheck('const text = "(";\n// (\nconst x = 1;', "Node.js", "a.js")).pass, true);
  const quote = await syntaxCheck("const a = 1;\nconst b = 'oops;\nconst c = 3;", "Node.js", "a.js");
  assert.equal(quote.lineNumber, 2);
  assert.equal(quote.columnNumber, 11);
  const native = await syntaxCheck("const a = 1;\nconst b = ;\nconst c = 3;", "Node.js", "a.js");
  assert.equal(native.lineNumber, 2);
  assert.equal(native.columnNumber, 11);
  const python = await syntaxCheck("def run():\n    return (42\n", "Django", "a.py");
  assert.equal(python.lineNumber, 2);
  assert.equal(python.columnNumber, 12);
  const json = await syntaxCheck('{\n  "items": [\n    1,\n    2', "Node.js", "a.json");
  assert.equal(json.pass, false);
  assert.equal(json.lineNumber, 2);
  assert.equal(json.columnNumber, 12);
});

test("syntax-only context is bounded near a late error and never contains reference source", () => {
  const code = Array.from({ length: 1000 }, (_, n) => `const var${n} = ${n};`).join("\n");
  const result = syntaxErrorDiff(code, "راجع الصياغة.", 999, 10);
  assert.deepEqual(result.lines.map(row => row.lineNumber), [998, 999, 1000]);
  assert.equal(result.lines.filter(row => row.hint).length, 1);
});
