import assert from 'node:assert/strict';
import test from 'node:test';
import { anticipationDistance, milestoneLabel, nextMilestoneDistance, shouldShowPrideMoment } from './pride-moment-rules.ts';
test('milestones are only every fifth genuinely completed session', () => {
  for (let count = 0; count <= 40; count++) assert.equal(shouldShowPrideMoment(count), count > 0 && count % 5 === 0);
  for (const count of [-5, 2.5, NaN]) assert.equal(shouldShowPrideMoment(count), false);
});
test('anticipation appears during upcoming sessions 3/4 and repeats before later milestones', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(anticipationDistance), [null, null, 2, 1, null, null, null, 2, 1, null]);
});
test('identity text varies by milestone and forward hooks are calculated', () => {
  assert.equal(new Set([5, 10, 15, 20, 25, 30].map(milestoneLabel)).size, 6);
  assert.equal(milestoneLabel(5), 'صرت تكتب كود حقيقي 💪');
  assert.equal(milestoneLabel(10), 'عشر جلسات. هيك المطورين الحقيقيين بيبدأو');
  for (const count of [5, 10, 15, 20, 25, 30]) assert.equal(nextMilestoneDistance(count), 5);
});