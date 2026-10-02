import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request } from "express";
import { syntaxCheck } from "./student-code-syntax.ts";
import { safeStructurePattern, structureCheck, type BuildTask } from "./student-code-structure.ts";
import { boundedStudentCode, validateStudentCode } from "./student-code-validation.ts";

const task: BuildTask = {
  task_description: "اعرض رحلات flightService.getFlights() باستخدام StreamBuilder وListView.",
  starter_code: "StreamBuilder(stream: flightService.getFlights(), builder: (context, snapshot) => ...)",
  expected_keywords: ["StreamBuilder", "stream", "builder", "context", "snapshot", "ListView"],
  target_file: "lib/main.dart",
  existing_content: "",
  validation: {
    level2_rules: [
      { pattern: "StreamBuilder\\s*[<(]", error_if_missing: "استخدم StreamBuilder كـ widget." },
      { pattern: "stream\\s*:", error_if_missing: "حدد stream." },
      { pattern: "builder\\s*:", error_if_missing: "حدد builder." },
    ],
    level3_question: "هل يعرض الكود بيانات الرحلات من stream؟",
  },
};
const good = `StreamBuilder<List<Flight>>(
  stream: flightService.getFlights(),
  builder: (context, snapshot) {
    if (!snapshot.hasData) return const CircularProgressIndicator();
    return ListView(children: snapshot.data!.map((flight) => Text(flight.name)).toList());
  },
)`;
const logger = { info() {}, warn() {} };
const req = { log: logger } as unknown as Pick<Request, "log">;
const input = (code: string, customTask = task) => ({ code, task: customTask, concept: "StreamBuilder Widget", techStack: "Flutter" });
const noKeywords = { ...task, expected_keywords: [] };

test("keyword soup, empty input, comments, and mismatched brackets fail level 1 without AI calls", async () => {
  for (const code of ["", "StreamBuilder stream builder context snapshot ListView",
    "// StreamBuilder(stream: x, builder: y)", "StreamBuilder([)]", "StreamBuilder(builder: () => Text('unfinished))"]) {
    let called = false;
    const result = await validateStudentCode(input(code), req, async () => {
      called = true; throw new Error("Must not reach Gemini");
    });
    assert.equal(result.valid, false, code);
    assert.equal(result.level, 1, code);
    assert.equal(called, false);
    assert.match(result.feedback_ar, /[\u0600-\u06ff]/);
  }
});

test("StreamBuilder() fails level 2 for missing stream and builder parameters", async () => {
  const result = await validateStudentCode(input("StreamBuilder()", noKeywords), req);
  assert.equal(result.level, 2);
  assert.equal(result.semantic_status, "not_run");
  assert.match(result.feedback_ar, /stream/);
  assert.equal(structureCheck("StreamBuilder(stream: flights)", "StreamBuilder", noKeywords, "Flutter").pass, false);
});

test("comments and strings cannot satisfy widget parameters or model structural rules", () => {
  assert.equal(structureCheck(`StreamBuilder(/* stream: flights, builder: (c,s) */)`,
    "StreamBuilder", noKeywords, "Flutter").pass, false);
  assert.equal(structureCheck(`Text("StreamBuilder(stream: flights, builder: build)")`,
    "StreamBuilder", noKeywords, "Flutter").pass, false);
});

test("parameters on an unrelated call do not satisfy the selected widget", () => {
  assert.equal(structureCheck("StreamBuilder(); Other(stream: flights, builder: build);",
    "StreamBuilder", noKeywords, "Flutter").pass, false);
});

test("wrong logic fails semantic evaluation and does not take the outage fallback", async () => {
  const result = await validateStudentCode(input(`StreamBuilder(stream: null, builder: (c, s) => Text("Hi"))`, noKeywords), req,
    async () => ({ is_valid: false, score: 35, feedback_ar: "قريب، بس البيانات ما عم تنعرض من stream.", suggestions: ["راجع مصدر بيانات الرحلات."] }));
  assert.equal(result.valid, false);
  assert.equal(result.level, 3);
  assert.equal(result.semantic_status, "checked");
  assert.equal(result.score, 35);
});

test("correct code passes all levels with semantic score and suggestions", async () => {
  const result = await validateStudentCode(input(good), req, async () => ({
    is_valid: true, score: 92, feedback_ar: "ممتاز، طبّقت المفهوم على بيانات الرحلات.",
    suggestions: ["أضف واجهة لحالة الخطأ."],
  }));
  assert.equal(result.valid, true);
  assert.equal(result.level, 3);
  assert.equal(result.score, 92);
  assert.equal(result.can_retry, false);
});

test("a negative semantic verdict cannot pass merely by carrying a high score", async () => {
  const result = await validateStudentCode(input(good), req, async () => ({
    is_valid: false, score: 90, feedback_ar: "راجع منطق الحل.", suggestions: [],
  }));
  assert.equal(result.valid, false);
});

test("outages and the hard deadline accept only passed local checks and label semantic verification unavailable", async () => {
  for (const evaluator of [
    async () => { throw new Error("provider failure"); },
    async () => new Promise<never>(() => {}),
  ]) {
    const result = await validateStudentCode(input(good), req, evaluator, 15);
    assert.equal(result.valid, true);
    assert.equal(result.semantic_status, "unavailable");
    assert.equal(result.score, null);
    assert.equal(result.level, 2);
  }
});

test("valid JavaScript, React JSX, Python, and YAML parse without running student code", async () => {
  assert.equal((await syntaxCheck("const answer = () => 42;", "Node.js", "src/index.js")).pass, true);
  assert.equal((await syntaxCheck("const pattern = /['\"(]/g; const test = pattern.test(input);", "Node.js", "src/index.js")).pass, true);
  assert.equal((await syntaxCheck("export const Card = () => <div>Hello</div>;", "React", "src/Card.jsx")).pass, true);
  assert.equal((await syntaxCheck("def flights():\n    return []", "Django", "flights.py")).pass, true);
  assert.equal((await syntaxCheck("dependencies:\n  flutter:\n    sdk: flutter\n  provider: ^6.1.0\n", "Flutter", "pubspec.yaml")).pass, true);
});

test("YAML descriptions with apostrophes are valid and comments cannot satisfy required dependencies", async () => {
  const code = "description: Let's build a flight app\ndependencies:\n  provider: ^6.1.0\n";
  const yamlTask = { ...task, target_file: "pubspec.yaml", validation: undefined, expected_keywords: ["provider"] };
  assert.equal((await syntaxCheck(code, "Flutter", "pubspec.yaml")).pass, true);
  assert.equal(structureCheck(code, "Dependency Management", yamlTask, "Flutter").pass, true);
  assert.equal(structureCheck("name: flights\n# dependencies: provider", "Dependency Management", yamlTask, "Flutter").pass, false);
});

test("broken JSX, Python indentation, YAML, and Dart statements fail syntax checks", async () => {
  for (const [code, stack, path] of [
    ["export const X = () => <div><span></div>;", "React", "src/X.jsx"],
    ["def flights()\nreturn []", "Django", "flights.py"],
    ["dependencies: [flutter", "Flutter", "pubspec.yaml"],
    ["void main() { final count = 2\n print(count); }", "Flutter", "lib/main.dart"],
  ]) assert.equal((await syntaxCheck(code, stack, path)).pass, false, code);
});

test("generated structural patterns use a bounded grammar, not arbitrary regular expressions", () => {
  for (const pattern of ["StreamBuilder\\s*[<(]", "stream\\s*:", "builder\\s*:", "useState\\s*\\(", "state\\s*="]) {
    assert.ok(safeStructurePattern(pattern), pattern);
  }
  for (const pattern of ["(a+)+$", ".*", "(?=foo)", "foo|bar", "\\w+"] ) {
    assert.equal(safeStructurePattern(pattern), null, pattern);
  }
});

test("Gemini receives at most 2000 code characters and prioritizes the new solution in modify tasks", () => {
  assert.ok(boundedStudentCode("x".repeat(30000)).length <= 2000);
  assert.equal(boundedStudentCode("old source\nnew solution()", "old source\n"), "new solution()");
});