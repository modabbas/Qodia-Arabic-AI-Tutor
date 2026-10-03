import assert from "node:assert/strict";
import test from "node:test";
import type { AnyFieldSession } from "@workspace/api-zod";
import { anyFieldSessionIssues, AnyFieldDemoBudget } from "./any-field-demo-rules.ts";

function example(): AnyFieldSession {
  const challenge = {
    scenario_ar: "سيناريو جامعي افتراضي", question_ar: "أي اختيار مناسب؟",
    options: [{ text_ar: "خيار مناسب", correct: true }, { text_ar: "خيار غير مناسب", correct: false }],
    feedback_ar: "يرتبط الاختيار بالمفهوم الموضّح.",
  };
  return {
    field: "هندسة معمارية", topic: "التهوية الطبيعية", source: "gemini",
    touch1_challenge: structuredClone(challenge), touch3_explore: structuredClone(challenge),
    touch2_reveal: { explanation_ar: "شرح مفهومي", ...structuredClone(challenge) },
    touch4_analyze: {
      task_type: "order_steps", instruction_ar: "رتّب خطوات التفكير في التصميم",
      items: [
        { id: "site", text_ar: "تحديد المعطيات", correct: true, order_index: 0 },
        { id: "design", text_ar: "اقتراح الحل", correct: true, order_index: 1 },
        { id: "review", text_ar: "مراجعة النتيجة", correct: true, order_index: 2 },
      ],
      feedback_ar: "ابدأ بالمعطيات قبل اقتراح الحل.",
    },
    touch5_defend: { question_ar: "لماذا اخترت هذا الحل؟" },
  };
}

test("accepts complete multiple-choice and ordering sessions without student grading", () => {
  assert.deepEqual(anyFieldSessionIssues(example()), []);
  const session = example();
  session.touch4_analyze.task_type = "multiple_choice";
  session.touch4_analyze.items.forEach((item, index) => { item.correct = index === 1; item.order_index = 0; });
  assert.deepEqual(anyFieldSessionIssues(session), []);
});
test("rejects ambiguous answer keys for each of the first three touches", () => {
  for (const key of ["touch1_challenge", "touch2_reveal", "touch3_explore"] as const) {
    const session = example();
    session[key].options.forEach(option => { option.correct = false; });
    assert.equal(anyFieldSessionIssues(session).length, 1);
    session[key].options.forEach(option => { option.correct = true; });
    assert.equal(anyFieldSessionIssues(session).length, 1);
  }
});
test("rejects duplicated choices and invalid, duplicated or missing order positions", () => {
  const session = example();
  session.touch1_challenge.options[1]!.text_ar = session.touch1_challenge.options[0]!.text_ar;
  session.touch4_analyze.items[1]!.id = session.touch4_analyze.items[0]!.id;
  session.touch4_analyze.items[1]!.order_index = 0;
  assert.deepEqual(anyFieldSessionIssues(session), ["touch1_duplicate_options", "touch4_duplicate_ids", "touch4_invalid_order"]);
  const gap = example();
  gap.touch4_analyze.items[2]!.order_index = 3;
  assert.deepEqual(anyFieldSessionIssues(gap), ["touch4_invalid_order"]);
});
test("validates analysis answer keys independently of ordering", () => {
  const session = example();
  session.touch4_analyze.task_type = "multiple_choice";
  assert.deepEqual(anyFieldSessionIssues(session), ["touch4_correct_option"]);
});
test("memory-only demo request limits expire and remain separate per client", () => {
  const budget = new AnyFieldDemoBudget(2, 100);
  assert.equal(budget.consume("visitor-a", 0), true);
  assert.equal(budget.consume("visitor-a", 20), true);
  assert.equal(budget.consume("visitor-a", 40), false);
  assert.equal(budget.consume("visitor-b", 40), true);
  assert.equal(budget.consume("visitor-a", 100), true);
});
test("bounded limiter fails closed rather than evicting a visitor's active limit", () => {
  const budget = new AnyFieldDemoBudget(1, 1000);
  for (let i = 0; i < 1024; i++) assert.equal(budget.consume(`visitor-${i}`, 0), true);
  assert.equal(budget.consume("overflow", 0), false);
  assert.equal(budget.consume("visitor-0", 1), false);
  assert.equal(budget.consume("overflow", 1000), true);
});