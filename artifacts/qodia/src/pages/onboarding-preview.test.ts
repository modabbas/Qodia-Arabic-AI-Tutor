import assert from 'node:assert/strict';
import test from 'node:test';
import { firstChallengePreview } from './onboarding-preview.ts';

test('every supported stack has its own relevant preview', () => {
  for (const [stack, concept] of [
    ['React', 'useState'],
    ['Flutter', 'StatefulWidget'],
    ['Django', 'ForeignKey'],
    ['Node.js', 'Routes'],
  ]) {
    const preview = firstChallengePreview(stack);
    assert.ok(preview.title.includes(stack));
    assert.ok(preview.title.includes(concept));
    assert.equal(preview.description, 'خمس لمسات بينك وبين جواب أوضح');
    if (stack !== 'Django') assert.ok(!preview.title.includes('Django'));
  }
});

test('empty and unknown selections use a neutral fallback', () => {
  for (const stack of ['', 'Unknown', 'constructor', '__proto__']) {
    const preview = firstChallengePreview(stack);
    assert.equal(preview.title, 'اختر التقنية لتشوف معاينة أول تحدّي');
    assert.ok(!preview.title.includes('Django'));
  }
});

test('changing the selection immediately derives the new preview', () => {
  const first = firstChallengePreview('React');
  const second = firstChallengePreview('Flutter');
  const third = firstChallengePreview('Django');
  assert.notEqual(first.title, second.title);
  assert.notEqual(second.title, third.title);
  assert.equal(firstChallengePreview('React').title, first.title);
});