import assert from "node:assert/strict";
import test from "node:test";
import {
  canRevealHint,
  canRevealNextHint,
  firstTryBonusEligible,
  hintActivityClock,
  hintIdleReady,
  touch4HintIdleMs,
  hint3TeachingFailureReason,
  parseTouch4HintBundle,
  touch4HintBundleFailureReason,
  touch4SessionXp,
  touch4XpPenalty,
  xpDeltaForSession,
} from "./touch4-support-rules.ts";

const bundle = {
  hints: [
    { level: 1, type: "guidance", text_ar: "فكر بمكان إعداد العنصر", example: "قسم الإعدادات", code_example: "dependency: generic-example" },
    { level: 2, type: "similar_example", text_ar: "شوف مثال قريب لمكتبة ثانية", code_example: "library: other" },
    { level: 3, type: "partial_solution", text_ar: "حدد القسم اللي بيجمع المكتبات المستخدمة. كيف بتوصل المكتبة المطلوبة ببيئة المشروع؟" },
  ],
  reference_solution: "dependency: full-solution",
};

test("hint 1 is immediate; later hints unlock from idle or a new failure", () => {
  assert.equal(canRevealNextHint(0, 0, 0), true);
  assert.equal(canRevealHint(0, 1, 0, 1), true);
  assert.equal(canRevealHint(0, 1, 0, 2), false);
  // If the first hint is used after multiple failures, another failure is still required.
  assert.equal(canRevealHint(1, 2, 2, 2), false);
  assert.equal(canRevealHint(1, 3, 2, 2), true);
  assert.equal(canRevealHint(2, 3, 3, 3), false);
  assert.equal(canRevealHint(2, 4, 3, 3), true);
  assert.equal(canRevealNextHint(3, 100, 4), false);
  assert.equal(canRevealNextHint(0, 1, 0, true), false);
  assert.equal(canRevealNextHint(3, 100, 4, false, true), false);
  assert.equal(canRevealHint(1, 0, 0, 2), false);
  assert.equal(canRevealHint(1, 0, 0, 2, false, false, true), true);
  assert.equal(canRevealHint(1, 1, 0, 2), true);
  assert.equal(canRevealHint(2, 1, 0, 3), true);
  assert.equal(canRevealHint(2, 0, 0, 3, false, false, true), true);
  assert.equal(canRevealHint(2, 0, 0, 3, true, false, true), false);
  assert.equal(canRevealHint(1, 0, 0, 2, false, true, true), false);
});

test("hint schema distinguishes exactly three ordered levels and their content", () => {
  assert.deepEqual(parseTouch4HintBundle(bundle), bundle);
  assert.equal(parseTouch4HintBundle({ ...bundle, hints: bundle.hints.slice(0, 2) }), null);
  assert.equal(parseTouch4HintBundle({
    ...bundle,
    hints: [{ ...bundle.hints[0], type: "partial_solution" }, ...bundle.hints.slice(1)],
  }), null);
  assert.equal(parseTouch4HintBundle({
    ...bundle,
    hints: [bundle.hints[0], { ...bundle.hints[1], text_ar: bundle.hints[0].text_ar }, bundle.hints[2]],
  }), null);
  assert.equal(parseTouch4HintBundle({
    ...bundle,
    hints: [{ ...bundle.hints[0], text_ar: "No Arabic" }, ...bundle.hints.slice(1)],
  }), null);
  assert.equal(parseTouch4HintBundle({
    ...bundle,
    hints: [{ ...bundle.hints[0], text_ar: "ت".repeat(701) }, ...bundle.hints.slice(1)],
  }), null);
  assert.equal(parseTouch4HintBundle({
    ...bundle,
    hints: [bundle.hints[0], { ...bundle.hints[1], code_example: "" }, bundle.hints[2]],
  }), null);
  assert.equal(parseTouch4HintBundle({
    ...bundle,
    hints: [bundle.hints[0], { ...bundle.hints[1], code_example: "ع".repeat(2001) }, bundle.hints[2]],
  }), null);
  assert.ok(parseTouch4HintBundle({
    ...bundle,
    hints: [{ ...bundle.hints[0], code_example: "dependency: real syntax" }, ...bundle.hints.slice(1)],
  }));
  assert.equal(parseTouch4HintBundle({
    ...bundle,
    hints: [bundle.hints[0], bundle.hints[1], { ...bundle.hints[2], code_example: "dependency: full solution" }],
  }), null);
  assert.equal(touch4HintBundleFailureReason({
    ...bundle,
    hints: [bundle.hints[0], bundle.hints[1], { ...bundle.hints[2], code_example: "dependency: full solution" }],
  }), "level3_code_example_forbidden");
  assert.equal(parseTouch4HintBundle({
    ...bundle,
    hints: [bundle.hints[0], bundle.hints[1], { ...bundle.hints[2], code_example: bundle.hints[1].code_example }],
  }), null);
  assert.equal(parseTouch4HintBundle({ ...bundle, reference_solution: "ع".repeat(4001) }), null);
});

test("historical hint 1 gains its existing generic syntax without regeneration or changing later tiers", () => {
  const { code_example: _oldCode, ...oldHint } = bundle.hints[0];
  const upgraded = parseTouch4HintBundle({ ...bundle, hints: [oldHint, ...bundle.hints.slice(1)] });
  assert.equal(upgraded?.hints[0].code_example, bundle.hints[1].code_example);
  assert.deepEqual(upgraded?.hints.slice(1), bundle.hints.slice(1));
});

test("third hint is functional prose plus a question, never executable code or a blank template", () => {
  assert.equal(hint3TeachingFailureReason({
    text_ar: "الدالة اللي بتحتاجها بتجي من management.commands وبتاخد sys.argv كمعامل. فكر: شو بتستدعي Django لما تشغل python manage.py؟",
  }), null);
  for (const text_ar of [
    "شو ناقص هون: from django.core.management import ____ ؟",
    "شو ناقص هون: from django.core.management import execute_from_command_line ؟",
    "فكّر بهالسطر: execute_from_command_line(sys.argv) ؟",
    "كيف بتكمل const answer = 42 ؟",
    "كيف بتكمل return 42 ؟",
    "كيف بتكمل dependency: full-solution ؟",
    "كيف تكتب الحل باستخدام TODO ؟",
    "راجع القالب ```python manage.py``` ؟",
  ]) assert.equal(hint3TeachingFailureReason({ text_ar }), "level3_code_in_text_forbidden", text_ar);
  assert.equal(hint3TeachingFailureReason({ text_ar: "فكر بوظيفة الدالة المطلوبة." }), "level3_guiding_question_required");
  assert.equal(hint3TeachingFailureReason({ ...bundle.hints[2], example: "from x import ____" }), "level3_example_forbidden");
});

test("old cached templates remain readable only in explicit legacy mode, not deliverable as new hints", () => {
  const legacy = { ...bundle, hints: [bundle.hints[0], bundle.hints[1],
    { level: 3, type: "partial_solution", text_ar: "كمّل الفراغات بالقالب", code_example: "dependency: ____" }] };
  assert.equal(parseTouch4HintBundle(legacy), null);
  assert.deepEqual(parseTouch4HintBundle(legacy, true), legacy);
  assert.deepEqual(parseTouch4HintBundle(bundle, true), bundle);
  assert.equal(hint3TeachingFailureReason(legacy.hints[2]), "level3_code_example_forbidden");
});

test("all levels require contiguous reveals; only hint 1 is unconditional", () => {
  for (let used = 0; used < 3; used++) {
    for (let level = 1; level <= 3; level++) {
      assert.equal(canRevealHint(used, used + 1, used, level), level === used + 1);
      assert.equal(canRevealHint(used, used, used, level), used === 0 && level === 1);
      assert.equal(canRevealHint(used, used, used, level, false, false, true), level === used + 1);
    }
  }
  assert.equal(canRevealNextHint(-1, 4, 0), false);
  assert.equal(canRevealNextHint(1.5, 4, 0), false);
  assert.equal(canRevealHint(0, 1, 0, 1.5), false);
});

test("idle deadline starts at 35 seconds, typing resets it, and checks do not reset it", () => {
  const start = hintActivityClock(null, false, "idle", 1_000);
  assert.equal(start.hintIdleDeadline!.getTime(), 1_000 + touch4HintIdleMs);
  assert.equal(hintIdleReady(start.hintIdleDeadline, false, 35_999), false);
  assert.equal(hintIdleReady(start.hintIdleDeadline, false, 36_000), true);
  const typed = hintActivityClock(start.hintIdleDeadline, false, "typing", 20_000);
  assert.equal(typed.hintIdleDeadline!.getTime(), 55_000);
  const checked = hintActivityClock(typed.hintIdleDeadline, false, "idle", 40_000);
  assert.equal(checked.hintIdleDeadline!.getTime(), 55_000);
  assert.equal(checked.nextHintUnlocked, false);
  const unlocked = hintActivityClock(checked.hintIdleDeadline, false, "idle", 55_000);
  assert.equal(unlocked.nextHintUnlocked, true);
  assert.deepEqual(hintActivityClock(unlocked.hintIdleDeadline, true, "typing", 60_000), unlocked);
});

test("hint and solution penalties are cumulative, idempotent-state bounded, and max at 50", () => {
  assert.deepEqual([0, 1, 2, 3].map((used) => touch4XpPenalty(used, false)), [0, 10, 20, 30]);
  assert.equal(touch4XpPenalty(3, true), 50);
  assert.equal(touch4XpPenalty(9, true), 50);
});

test("first-try bonus requires a fresh accepted save with no old submission evidence", () => {
  assert.equal(firstTryBonusEligible(1, 0, 0, false, false), true);
  assert.equal(firstTryBonusEligible(2, 0, 0, false, false), false);
  assert.equal(firstTryBonusEligible(1, 1, 0, false, false), false);
  assert.equal(firstTryBonusEligible(1, 0, 1, false, false), false);
  assert.equal(firstTryBonusEligible(1, 0, 0, true, false), false);
  assert.equal(firstTryBonusEligible(1, 0, 0, false, true), false);
});

test("later success cannot get first-try bonus after an earlier server reservation", () => {
  const firstRequestAttemptIndex = 1;
  const laterFastSuccessAttemptIndex = 2;
  assert.equal(firstTryBonusEligible(laterFastSuccessAttemptIndex, 0, 0, false, false), false);
  // A late result from the first request is also disqualified by any prior saved submission evidence.
  assert.equal(firstTryBonusEligible(firstRequestAttemptIndex, 0, 0, false, true), false);
});

test("session XP uses server-owned saved support and duplicate delta returns zero", () => {
  assert.equal(touch4SessionXp(110, 0, 0, true), 110);
  assert.equal(touch4SessionXp(110, 50, 0, true), 160);
  assert.equal(touch4SessionXp(110, 0, 30, true), 80);
  assert.equal(touch4SessionXp(110, 0, 50, false), 110);
  assert.equal(xpDeltaForSession(80, 80), 0);
  assert.equal(xpDeltaForSession(80, 100), 20);
  assert.equal(xpDeltaForSession(80, 60), -20);
});