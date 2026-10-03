import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowConnectThread } from './connect-thread-rules.ts';
const thread = {
  intro_ar: 'مثال', integration_snippet: '1\n2\n3\n4\n5', comprehension_question_ar: 'السؤال',
  options: [{ text_ar: 'نعم', correct: true }, { text_ar: 'لا', correct: false }],
};

test('only every fourth completed session with opt-in and content shows reinforcement', () => {
  for (const completedCount of [4, 8, 12, 100]) {
    assert.equal(shouldShowConnectThread({ secondaryStack: 'React', completedCount, thread }), true);
  }
  for (const completedCount of [undefined, 0, 1, 2, 3, 5, 6, 7, -4, 4.5, NaN]) {
    assert.equal(shouldShowConnectThread({ secondaryStack: 'React', completedCount, thread }), false);
  }
});
test('absent secondary stack or missing optional content leaves celebration unchanged', () => {
  for (const secondaryStack of ['', null, undefined]) assert.equal(shouldShowConnectThread({ secondaryStack, completedCount: 4, thread }), false);
  assert.equal(shouldShowConnectThread({ secondaryStack: 'Vue', completedCount: 4, thread: undefined }), false);
});