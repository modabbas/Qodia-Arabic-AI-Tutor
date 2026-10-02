import assert from "node:assert/strict";
import test from "node:test";
import { completedConceptEncounters, scaffoldingFor, validFirstMove } from "./touch4-scaffolding.ts";

const choice = {
  question_ar: "شو أول خطوة؟",
  options: [{ id: "a", text_ar: "تعريف الحالة", correct: true }, { id: "b", text_ar: "تحميل البيانات", correct: false }],
  scaffold_code_on_correct: "const [open, setOpen] = useState(",
};
test("exactly one answer, unique options and incomplete reference prefix", () => {
  assert.ok(validFirstMove(choice, `${choice.scaffold_code_on_correct}false);`));
  assert.ok(!validFirstMove(choice, choice.scaffold_code_on_correct));
  assert.ok(!validFirstMove({ ...choice, scaffold_code_on_correct: "const answer = 42" }, "const answer = 42;"));
  assert.ok(!validFirstMove(choice, "unrelated code"));
  assert.ok(!validFirstMove({ ...choice, scaffold_code_on_correct: "const x = 42;" }, "const x = 42;\n// just a comment"));
  assert.ok(!validFirstMove({ ...choice, options: choice.options.map(option => ({ ...option, correct: true })) }, `${choice.scaffold_code_on_correct}false);`));
  assert.ok(!validFirstMove({ ...choice, options: [choice.options[0], choice.options[0]] }, `${choice.scaffold_code_on_correct}false);`));
});
test("first encounter and low-mastery reinforcement stay guided", () => {
  assert.equal(scaffoldingFor(choice, null, 0, false).tier, "guided");
  assert.equal(scaffoldingFor(choice, 69, 1, true).tier, "guided");
});
test("review at 70 to 89 reduces the prefix", () => {
  for (const score of [70, 75, 89]) {
    const result = scaffoldingFor(choice, score, 1, true);
    assert.equal(result.tier, "reduced");
    assert.ok(result.prefix.length <= 5);
    assert.ok(choice.scaffold_code_on_correct.startsWith(result.prefix));
  }
});
test("high mastery or third encounter removes scaffolding", () => {
  for (const [mastery, count] of [[90, 1], [100, 1], [60, 2], [75, 3]]) {
    const result = scaffoldingFor(choice, mastery, count, true);
    assert.equal(result.tier, "none");
    assert.equal(result.prefix, "");
  }
});
test("legacy lessons are preserved without invented options or AI calls", () => {
  assert.equal(scaffoldingFor(undefined, null, 0, false).tier, "none");
  assert.ok(scaffoldingFor(undefined, null, 0, false).legacy_lesson);
});
test("repeat tracking includes legacy names, excludes partial and current lesson records", () => {
  const row = { conceptId: "c1", concept: "React useState — الحالة", lessonId: "old", touchesCompleted: 5 };
  assert.equal(completedConceptEncounters([
    row, { ...row, conceptId: null, lessonId: "legacy" },
    { ...row, lessonId: "current" }, { ...row, touchesCompleted: 4 },
    { ...row, conceptId: "c2" },
  ], "c1", "React useState", "current"), 2);
});