import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionPerformance } from './session-performance.ts';

test('a perfect session counts five touches, including both first-pass defense answers', () => {
  assert.deepEqual(sessionPerformance(Array.from({ length: 5 }, () => ({ passed: true })), true, 90_000), {
    touches_correct: 5, completion_time: 1.5, build_passed: true,
  });
});

test('an eventual correct defense follow-up does not erase a wrong first answer', () => {
  assert.equal(sessionPerformance(Array.from({ length: 5 }, () => ({ passed: true })), false, 1).touches_correct, 4);
});

test('wrong teaching touches and a hinted or retried build are not counted as first-pass successes', () => {
  const result = sessionPerformance([{ passed: false }, { passed: true }, { passed: false }, { passed: false }, { passed: true }], true, 600_000);
  assert.equal(result.touches_correct, 2);
  assert.equal(result.build_passed, false);
  assert.equal(result.completion_time, 10);
});

test('missing results and invalid elapsed time fail conservatively', () => {
  assert.deepEqual(sessionPerformance([], true, Number.NaN), { touches_correct: 0, completion_time: 0, build_passed: false });
  assert.equal(sessionPerformance([], false, -100).completion_time, 0);
});