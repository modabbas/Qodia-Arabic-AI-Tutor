import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acceptActivitySnapshot, activityTracks, nextIdleDelay } from './hint-controls.ts';
import type { Touch4Support } from '@workspace/api-client-react';

const s = (o: Partial<Touch4Support> = {}) => ({ lesson_id: 'a', attempts: 0, failed_attempts: 0, hints_used: 1, xp_penalty: 10,
  first_try_bonus: 0, build_saved: false, can_reveal_next: false, next_hint_wait_ms: 35000, solution_viewed: false, revealed_hints: [], ...o }) as Touch4Support;

test('activity only tracks after hint 1 or 2 before save or solution', () => {
  assert.equal(activityTracks(s(), false), true);
  assert.equal(activityTracks(s({ hints_used: 0 }), false), false);
  assert.equal(activityTracks(s({ hints_used: 3 }), false), false);
  assert.equal(activityTracks(s({ build_saved: true }), false), false);
  assert.equal(activityTracks(s(), true), false);
});
test('stale snapshots are ignored', () => {
  assert.equal(acceptActivitySnapshot(s({ hints_used: 2 }), s({ hints_used: 1 }), 'a'), false);
  assert.equal(acceptActivitySnapshot(s(), s({ lesson_id: 'b' }), 'a'), false);
  assert.equal(acceptActivitySnapshot(s({ build_saved: true }), s(), 'a'), false);
  assert.equal(acceptActivitySnapshot(s({ can_reveal_next: true }), s(), 'a'), false);
  assert.equal(acceptActivitySnapshot(s(), s({ can_reveal_next: true }), 'a'), true);
});
test('idle delay uses server wait with a safe floor after responses', () => {
  assert.equal(nextIdleDelay(12000, false), 12000);
  assert.equal(nextIdleDelay(0, true), 2000);
  assert.equal(nextIdleDelay(null, false), 35000);
});
