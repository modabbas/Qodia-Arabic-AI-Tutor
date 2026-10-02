import assert from 'node:assert/strict';
import test from 'node:test';
import { editableSelection, keepsLockedPrefix, resolveScaffold, restoreStudentDraft } from './touch4-editor-policy.ts';

test('guided input waits for the first move; reduced and independent input do not', () => {
  assert.deepEqual(resolveScaffold('guided', 'const x = ', false, ''), { ready: false, prefix: '' });
  assert.deepEqual(resolveScaffold('guided', 'const x = ', true, ''), { ready: true, prefix: 'const x = ' });
  assert.deepEqual(resolveScaffold('reduced', 'cons', false, ''), { ready: true, prefix: 'cons' });
  assert.deepEqual(resolveScaffold('none', '', false, ''), { ready: true, prefix: '' });
});
test('restored drafts are not overwritten or given a duplicate prefix', () => {
  assert.deepEqual(resolveScaffold('guided', 'const x = ', false, 'const x = 42;'), { ready: true, prefix: 'const x = ' });
  assert.deepEqual(resolveScaffold('guided', 'const x = ', false, 'let x = 42;'), { ready: true, prefix: '' });
});
test('async draft restoration replaces only an automatic prefix, never fresh student typing', () => {
  assert.equal(restoreStudentDraft('cons', 'let answer = 42;', 'cons'), 'let answer = 42;');
  assert.equal(restoreStudentDraft('', 'const answer = 42;', 'cons'), 'const answer = 42;');
  assert.equal(restoreStudentDraft('const newWork = 1;', 'let answer = 42;', 'cons'), 'const newWork = 1;');
});
test('prefix deletion, replacement and selection are blocked; continuation remains editable', () => {
  assert.ok(keepsLockedPrefix('const x = 42;', 'const x = '));
  assert.ok(!keepsLockedPrefix('let x = 42;', 'const x = '));
  assert.ok(!keepsLockedPrefix('const x', 'const x = '));
  assert.deepEqual(editableSelection(0, 12, 10), [10, 12]);
  assert.deepEqual(editableSelection(15, 18, 10), [15, 18]);
});