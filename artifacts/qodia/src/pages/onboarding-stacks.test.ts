import assert from 'node:assert/strict';
import test from 'node:test';
import { onboardingStacks, secondaryStackOptions, secondaryAfterPrimaryChange } from './onboarding-stacks.ts';

test('both dropdowns share the supported technologies in the same order', () => {
  assert.deepEqual(onboardingStacks, ['Django', 'Node.js', 'React', 'Flutter']);
  assert.deepEqual(secondaryStackOptions(''), onboardingStacks);
});

test('secondary options exclude each primary stack and preserve the shared order', () => {
  for (const primary of onboardingStacks) {
    assert.deepEqual(secondaryStackOptions(primary), onboardingStacks.filter(item => item !== primary));
    assert.ok(!secondaryStackOptions(primary).includes(primary));
  }
});

test('primary changes clear only a conflicting secondary selection', () => {
  for (const primary of onboardingStacks) {
    assert.equal(secondaryAfterPrimaryChange(primary, primary), '');
    assert.equal(secondaryAfterPrimaryChange(primary, ''), '');
    for (const secondary of secondaryStackOptions(primary)) {
      assert.equal(secondaryAfterPrimaryChange(primary, secondary), secondary);
    }
  }
});