import assert from "node:assert/strict";
import { test } from "node:test";
import { liveSyntaxIssues } from "./touch4-live-syntax.ts";

test("local cues find exact brackets, quotes, Python/YAML nesting without blocking", () => {
  assert.ok(liveSyntaxIssues("const a = 1;\nconst b = (];", "a.js").some(line => line.lineNumber === 2));
  assert.ok(liveSyntaxIssues("def flights():\nreturn []", "a.py").some(line => line.lineNumber === 2));
  assert.ok(liveSyntaxIssues("dependencies:\n  flutter:\n    sdk: flutter\n   provider: x", "pubspec.yaml").some(line => line.lineNumber === 4));
  assert.ok(liveSyntaxIssues("const a = 1;\nconst name = 'unfinished", "a.js").some(line => line.lineNumber === 2));
});

test("quoted text, comments, regex, consistent tabs and valid YAML are not syntax errors", () => {
  for (const [code, file] of [
    ['const x = "([)]"; // (', "a.js"],
    [`const regex = /['"(]/g; const x = () => 42;`, "a.js"],
    ["dependencies:\n    flutter:\n        sdk: flutter\n    intl: ^0.18.0", "pubspec.yaml"],
    ["description: Let's build an app\nname: flights", "pubspec.yaml"],
    ['description: |\n  "hello (world\n  still a description', "pubspec.yaml"],
    ["def flights():\n\treturn []", "a.py"],
    ["const a = (\n  1 + 2\n);", "a.js"],
    ['def greet():\n    return """multi\n  line ([)] text\nvalue"""', "a.py"],
  ]) assert.deepEqual(liveSyntaxIssues(code, file), [], code);
});

test("local feedback is bounded for oversized pasted/restored files", () => {
  assert.deepEqual(liveSyntaxIssues("x".repeat(100_001), "a.js"), []);
  assert.ok(liveSyntaxIssues("(\n".repeat(100), "a.js").length <= 20);
});