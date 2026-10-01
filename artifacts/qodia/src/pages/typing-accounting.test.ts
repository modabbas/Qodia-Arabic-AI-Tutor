import test from 'node:test';
import assert from 'node:assert/strict';
import { createTypingCounter, insertedCount } from './typing-accounting.ts';

test('selection replacement with equal net length counts inserted data', () => {
  assert.equal(insertedCount({ inputType: 'insertText', data: 'x' }, 0), 1);
  assert.equal(insertedCount({ inputType: 'insertText', data: 'ab' }, 0), 2);
});
test('deletions, paste, drop, history and replacement text count zero', () => {
  for (const inputType of ['deleteContentBackward', 'deleteByCut', 'insertFromPaste', 'insertFromDrop', 'historyUndo', 'historyRedo', 'insertReplacementText'])
    assert.equal(insertedCount({ inputType, data: 'abcdef' }, 6), 0);
});
test('line breaks count one', () => {
  assert.equal(insertedCount({ inputType: 'insertLineBreak', data: null }, 1), 1);
});
test('emoji counts as one code point', () => assert.equal(insertedCount({ inputType: 'insertText', data: '😀' }, 2), 1));
test('five typed characters earn one practice point', () => {
  const c = createTypingCounter();
  const gains = [1, 2, 3, 4, 5].map(() => c.input({ inputType: 'insertText', data: 'a' }, 1));
  assert.deepEqual(gains, [0, 0, 0, 0, 1]);
});
test('IME commit longer than 20 counts once', () => {
  const c = createTypingCounter();
  c.compositionStart();
  assert.equal(c.input({ inputType: 'insertCompositionText', data: 'x'.repeat(25), isComposing: true }, 25), 0);
  assert.equal(c.compositionEnd('x'.repeat(25), 1000), 5);
  assert.equal(c.total, 25);
});
test('post-composition duplicate insertText is ignored', () => {
  const c = createTypingCounter();
  c.compositionStart();
  c.compositionEnd('مرحبا', 1000);
  assert.equal(c.input({ inputType: 'insertText', data: 'مرحبا' }, 5, 1020), 0);
  assert.equal(c.total, 5);
  assert.equal(c.input({ inputType: 'insertText', data: 'a' }, 1, 5000), 0);
  assert.equal(c.total, 6);
});
test('input during composition is ignored', () => {
  const c = createTypingCounter();
  c.compositionStart();
  assert.equal(c.input({ inputType: 'insertText', data: 'a' }, 1), 0);
  assert.equal(c.total, 0);
});
