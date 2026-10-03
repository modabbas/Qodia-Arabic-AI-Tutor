import assert from "node:assert/strict";
import test from "node:test";
import { completedConceptEncounters, scaffoldingFor, validFirstMove, withFirstMoveFallback } from "./touch4-scaffolding.ts";

const choice = {
  question_ar: "شو أول خطوة؟",
  options: [{ id: "a", text_ar: "تعريف الحالة", correct: true }, { id: "b", text_ar: "تحميل البيانات", correct: false }],
  scaffold_code_on_correct: "const [open, setOpen] = useState(",
};
test("missing, malformed and unsafe first moves fall back without changing the rest of the lesson", () => {
  const base = { concept_id: "c1", touch1_provoke: { question: "keep" }, touch4_build: {
    reference_solution: `${choice.scaffold_code_on_correct}false);`, hints: ["unchanged"],
    task_description: "keep", target_file: "src/test.tsx",
  } };
  for (const first_move_choice of [
    undefined, null, "invalid", {}, { ...choice, options: "invalid" },
    { ...choice, options: [{ id: "a", text_ar: "one", correct: "true" }] },
    { ...choice, scaffold_code_on_correct: "unrelated" },
    { ...choice, scaffold_code_on_correct: base.touch4_build.reference_solution },
    { ...choice, options: choice.options.map(option => ({ ...option, correct: true })) },
    { ...choice, question_ar: "" },
    { ...choice, extra_field: "unsupported" },
  ]) {
    const input = { ...base, touch4_build: { ...base.touch4_build, first_move_choice } };
    const result = withFirstMoveFallback(input);
    assert.ok(result.reason);
    assert.deepEqual(result.input, base);
    assert.ok("first_move_choice" in input.touch4_build, "does not mutate the model/cache input");
    assert.equal(scaffoldingFor(undefined, null, 0, false).tier, "none");
  }
});
test("valid two/three-option variations preserve scaffolding with the correct answer in any position", () => {
  for (const options of [
    choice.options, [...choice.options].reverse(),
    [choice.options[1], { id: "c", text_ar: "خطوة لاحقة", correct: false }, choice.options[0]],
  ]) {
    const input = { touch4_build: { first_move_choice: { ...choice, options },
      reference_solution: `${choice.scaffold_code_on_correct}false);` } };
    assert.equal(withFirstMoveFallback(input).reason, null);
    assert.equal(withFirstMoveFallback(input).input, input);
  }
});
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
test("a reused ordinal concept id cannot make an unseen named concept familiar", () => {
  const old = { conceptId: "concept_1", concept: "Previously learned concept — قديم", lessonId: "old", touchesCompleted: 5 };
  assert.equal(completedConceptEncounters([old, { ...old, lessonId: "older" }], "concept_1", "Brand new concept", undefined), 0);
  assert.equal(completedConceptEncounters([
    { ...old, concept: "  BRAND   NEW CONCEPT — جديد" },
    { ...old, conceptId: null, concept: "Brand new concept" },
  ], "concept_1", "Brand new concept", undefined), 2);
});