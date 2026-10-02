import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hintButtonState, hintCanDisplay, type HintControlsState } from './hint-controls.ts';

const base: HintControlsState = {
  hints_used: 0, failed_attempts: 0, can_reveal_next: false, build_saved: false, solution_viewed: false,
};
test('hint buttons are sequential, and an untrusted availability flag cannot skip a level', () => {
  for (const level of [1, 2, 3]) assert.equal(hintButtonState(base, level, false), 'locked');
  const first = { ...base, failed_attempts: 1, can_reveal_next: true };
  assert.equal(hintButtonState(first, 1, false), 'available');
  assert.equal(hintButtonState(first, 2, false), 'locked');
  assert.equal(hintButtonState({ ...first, failed_attempts: 100 }, 3, false), 'locked');
  const usedFirst = { ...base, hints_used: 1, failed_attempts: 1 };
  assert.equal(hintButtonState(usedFirst, 1, false), 'unlocked');
  assert.equal(hintButtonState(usedFirst, 2, false), 'locked');
  assert.equal(hintButtonState({ ...usedFirst, failed_attempts: 2, can_reveal_next: true }, 2, false), 'available');
  assert.equal(hintButtonState({ ...usedFirst, failed_attempts: 3, can_reveal_next: true }, 3, false), 'locked');
  const usedSecond = { ...base, hints_used: 2, failed_attempts: 2 };
  assert.equal(hintButtonState(usedSecond, 3, false), 'locked');
  assert.equal(hintButtonState({ ...usedSecond, failed_attempts: 3, can_reveal_next: true }, 3, false), 'available');
});
test('unlocked hints stay reviewable after saves, completion and exhaustion without re-unlocking', () => {
  const exhausted = { ...base, hints_used: 3, failed_attempts: 3, build_saved: true, solution_viewed: true };
  for (const level of [1, 2, 3]) assert.equal(hintButtonState(exhausted, level, true), 'unlocked');
  assert.equal(hintButtonState({ ...base, failed_attempts: 1, can_reveal_next: true }, 1, true), 'locked');
});
test('the client will not display a previously cached partial-solution template as hint 3', () => {
  assert.equal(hintCanDisplay({ level: 3, text_ar: 'كمّل القالب', code_example: 'from x import ____' }), false);
  assert.equal(hintCanDisplay({ level: 3, text_ar: 'كمّل القالب' }), false);
  assert.equal(hintCanDisplay({ level: 3, text_ar: 'كيف بتوصل البرنامج بأداة تنفيذ الأوامر؟' }), true);
  assert.equal(hintCanDisplay({ level: 2, text_ar: 'مثال مشابه', code_example: 'const other = 7;' }), true);
});