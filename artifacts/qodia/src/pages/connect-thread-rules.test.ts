import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldShowConnectThread } from './connect-thread-rules.ts';
import { CONNECT_THREAD_TRIGGER } from '../../../../lib/api-zod/src/judge-demo-config.ts';
const thread = {
  intro_ar: 'مثال', integration_snippet: '1\n2\n3\n4\n5', comprehension_question_ar: 'السؤال',
  options: [{ text_ar: 'نعم', correct: true }, { text_ar: 'لا', correct: false }],
};

test('only every fourth completed session with opt-in and content shows reinforcement', () => {
  for (const completedCount of [4, 8, 12, 100]) {
    assert.equal(shouldShowConnectThread({ secondaryStack: 'React', completedCount, thread }, 4), true);
  }
  for (const completedCount of [undefined, 0, 1, 2, 3, 5, 6, 7, -4, 4.5, NaN]) {
    assert.equal(shouldShowConnectThread({ secondaryStack: 'React', completedCount, thread }, 4), false);
  }
});
test('judge trigger shows only after the first completed session', () => {
  assert.equal(shouldShowConnectThread({ secondaryStack: 'React', completedCount: 1, thread }, 'first'), true);
  for (const completedCount of [0, 2, 3, 4, 8, 12, undefined, -1, 1.5, NaN]) {
    assert.equal(shouldShowConnectThread({ secondaryStack: 'React', completedCount, thread }, 'first'), false);
  }
});
test('default eligibility follows the single shared trigger config', () => {
  for (const completedCount of [1, 2, 3, 4, 8, 12]) {
    assert.equal(shouldShowConnectThread({ secondaryStack: 'React', completedCount, thread }),
      CONNECT_THREAD_TRIGGER === 'first' ? completedCount === 1 : completedCount % CONNECT_THREAD_TRIGGER === 0);
  }
});
test('absent secondary stack or missing optional content leaves celebration unchanged', () => {
  for (const secondaryStack of ['', null, undefined]) assert.equal(shouldShowConnectThread({ secondaryStack, completedCount: 1, thread }), false);
  assert.equal(shouldShowConnectThread({ secondaryStack: 'Vue', completedCount: 1, thread: undefined }), false);
});