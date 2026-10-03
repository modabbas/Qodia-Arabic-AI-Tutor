import assert from 'node:assert/strict';
import test from 'node:test';
import { restoreTouch4Source, shuffledChunkOrder, validChunkOrder } from './touch4-input-state.ts';

test('every puzzle starts with all chunks once and not in canonical order', () => {
  for (let count = 3; count <= 6; count++) {
    const order = shuffledChunkOrder(count, () => .999);
    assert.ok(validChunkOrder(order, count));
    assert.notDeepEqual(order, Array.from({ length: count }, (_, index) => index));
  }
  assert.equal(validChunkOrder([], 0), false);
  assert.equal(validChunkOrder([0, 0, 1], 3), false);
});
test('restoring source removes its trusted prefix only once', () => {
  assert.deepEqual(restoreTouch4Source('const x = 7;', 'const x = '), { code: '7;', fullFile: false });
  assert.deepEqual(restoreTouch4Source('old saved source', 'different prefix'), { code: 'old saved source', fullFile: true });
  assert.deepEqual(restoreTouch4Source('full source', ''), { code: 'full source', fullFile: false });
});