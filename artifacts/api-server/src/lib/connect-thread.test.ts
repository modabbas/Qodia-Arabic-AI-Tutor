import assert from "node:assert/strict";
import test from "node:test";
import { connectThreadInstruction, secondaryStackContext, withConnectThreadFallback } from "./connect-thread.ts";

const thread = {
  intro_ar: "مثال React يستهلك بيانات الرحلات من واجهة Node.js بعد ربط المسار.",
  integration_snippet: "fetch('/api/flights')\n  .then(res => res.json())\n  .then(data => {\n    setFlights(data.flights);\n  });",
  comprehension_question_ar: "شو العلاقة بين كود المسار وعرض الرحلات؟",
  options: [{ text_ar: "الخادم يرجع البيانات والواجهة تعرضها", correct: true }, { text_ar: "React ينشئ جدول قاعدة البيانات", correct: false }],
};

test("secondary context is opt-in and accepts every offered secondary stack", () => {
  for (const value of ["React", "Vue", "Flutter", "Django", "Node.js", "Other"]) assert.equal(secondaryStackContext(value), value);
  for (const value of [null, undefined, "", "unknown", {}, 123]) {
    assert.equal(secondaryStackContext(value), null);
    assert.deepEqual(connectThreadInstruction(value), []);
  }
  assert.match(connectThreadInstruction("React").join("\n"), /React/);
  assert.match(connectThreadInstruction("Other").join("\n"), /شبهكود/);
});
test("valid optional reinforcement preserves primary lesson fields", () => {
  const primary = { concept_id: "concept_4", touch4_build: { target_file: "src/routes/flights.js" } };
  assert.deepEqual(withConnectThreadFallback({ ...primary, connect_thread: thread }), { ...primary, connect_thread: thread });
  assert.strictEqual(withConnectThreadFallback(primary), primary);
});
test("invalid optional reinforcement is omitted without blocking the primary lesson", () => {
  for (const invalid of [null, {}, { ...thread, integration_snippet: "one line" },
    { ...thread, integration_snippet: Array(9).fill("line").join("\n") },
    { ...thread, options: [] },
    { ...thread, options: thread.options.map(option => ({ ...option, correct: true })) },
    { ...thread, options: thread.options.map(option => ({ ...option, correct: false })) },
    { ...thread, options: thread.options.map(option => ({ ...option, text_ar: "same" })) },
    { ...thread, intro_ar: " " }]) {
    assert.deepEqual(withConnectThreadFallback({ concept_id: "unchanged", connect_thread: invalid }), { concept_id: "unchanged" });
  }
});