import assert from "node:assert/strict";
import { test } from "node:test";
import { composeTouch4Submission, getTouch4Mode, prepareTouch4Interaction } from "./touch4-interactions.ts";

const build = { starter_code: "// reference example", existing_content: "",
  reference_solution: 'import x from "x";\nconst root = x();\nroot.render("test");',
  first_move_choice: { scaffold_code_on_correct: 'import x from "x";\nconst root = ' } };
test("familiarity alone selects all three modes, not mastery", () => {
  assert.equal(getTouch4Mode(0), "drag-order");
  assert.equal(getTouch4Mode(1), "fill-blank");
  assert.equal(getTouch4Mode(2), "free-write");
  assert.equal(getTouch4Mode(10), "free-write");
});
test("historical multiline source can supply real chunks without generating a new lesson", () => {
  const prepared = prepareTouch4Interaction(build, 0);
  assert.equal(prepared.interaction_mode, "drag-order");
  assert.deepEqual(prepared.drag_order_lines, build.reference_solution.split("\n"));
  assert.equal(composeTouch4Submission(prepared, { content: "", input_kind: "chunk-order", chunk_order: [0, 1, 2] }), build.reference_solution);
});
test("second encounter moves the literal first-move prefix outside the student's continuation", () => {
  const prepared = prepareTouch4Interaction(build, 1);
  assert.equal(prepared.fixed_code, build.first_move_choice.scaffold_code_on_correct);
  assert.equal(composeTouch4Submission(prepared, { content: 'x();\nroot.render("test");', input_kind: "continuation" }), build.reference_solution);
});
test("wrong ordering is reconstructed, not given a new grading shortcut", () => {
  const prepared = prepareTouch4Interaction(build, 0);
  assert.equal(composeTouch4Submission(prepared, { content: "ignored spoof", input_kind: "chunk-order", chunk_order: [2, 1, 0] }), build.reference_solution.split("\n").reverse().join("\n"));
  assert.throws(() => composeTouch4Submission(prepared, { content: "", input_kind: "chunk-order", chunk_order: [0, 0, 2] }));
  assert.throws(() => composeTouch4Submission(prepared, { content: "", input_kind: "continuation" }));
});
test("full-file requests remain backward compatible and fixed source never comes from the client", () => {
  const prepared = prepareTouch4Interaction(build, 2);
  assert.equal(composeTouch4Submission(prepared, { content: "saved legacy draft" }), "saved legacy draft");
  assert.equal(composeTouch4Submission(prepared, { content: "saved legacy draft", input_kind: "full-file" }), "saved legacy draft");
});
test("the cached mode does not change on a refocus or a changed encounter count", () => {
  const prepared = prepareTouch4Interaction(build, 0);
  assert.deepEqual(prepareTouch4Interaction(prepared, 3), prepared);
});
test("a single-line expression supplies three exact chunks without regeneration or invented newline semantics", () => {
  const single = { ...build, starter_code: 'import x from "x";\n', fixed_code: 'import x from "x";\n',
    reference_solution: 'import x from "x";\nconsole.log("hello");', drag_order_lines: ["model formatting", "does not", "match source"] };
  const prepared = prepareTouch4Interaction(single, 0, true);
  assert.equal(prepared.interaction_mode, "drag-order");
  assert.equal(prepared.drag_order_lines?.length, 3);
  assert.equal(prepared.drag_order_separator, "");
  assert.equal(composeTouch4Submission(prepared, { content: "", input_kind: "chunk-order", chunk_order: [0, 1, 2] }), single.reference_solution);
});
test("a fixed complete line owns the reference newline rather than requiring an invisible initial Enter", () => {
  const prepared = prepareTouch4Interaction({ ...build, fixed_code: 'import x from "x";' }, 2, true);
  assert.equal(prepared.fixed_code, 'import x from "x";\n');
  assert.equal(composeTouch4Submission(prepared, { content: 'const root = x();\nroot.render("test");', input_kind: "continuation" }), build.reference_solution);
});