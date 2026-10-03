import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONFIDENCE_DECISION_MS, createConfidenceGate, getCalibrationReaction } from './confidence-calibration.ts';

test('all six calibration reactions match the requested matrix', () => {
  assert.equal(getCalibrationReaction('high', true), 'كنت متأكد ومحقق! 🎯');
  assert.equal(getCalibrationReaction('low', true), 'أنت أفضل مما تتوقع! 🎉');
  assert.equal(getCalibrationReaction('high', false), 'لحظة تعلم قوية 💡');
  assert.equal(getCalibrationReaction('low', false), 'توقعك كان دقيق، خلينا نفهمها سوا');
  assert.equal(getCalibrationReaction('medium', true), 'تمام، كان توقعك بمكانه ✓');
  assert.equal(getCalibrationReaction('medium', false), 'قريب، خلينا نشوف وين الفرق');
});

test('the choice settles once and removes the automatic timeout', async () => {
  let stops = 0;
  const gate = createConfidenceGate((_expire, delay) => {
    assert.equal(delay, CONFIDENCE_DECISION_MS);
    return () => { stops++; };
  });
  gate.choose('low');
  gate.choose('high');
  assert.equal(await gate.prediction, 'low');
  assert.equal(stops, 1);
});

test('three-second timeout is an honest skip, not fabricated confidence', async () => {
  let expire!: () => void;
  const gate = createConfidenceGate(callback => { expire = callback; return () => {}; });
  expire();
  gate.choose('medium');
  assert.equal(await gate.prediction, null);
});

test('fast validation must still wait for a prediction or skip', async () => {
  const gate = createConfidenceGate(() => () => {});
  let revealed = false;
  const result = Promise.resolve(true).then(async valid => {
    const choice = await gate.prediction;
    revealed = true;
    return { valid, choice };
  });
  await Promise.resolve();
  assert.equal(revealed, false);
  gate.choose('high');
  assert.deepEqual(await result, { valid: true, choice: 'high' });
});

test('early choice adds no new wait when slower validation finishes', async () => {
  const gate = createConfidenceGate(() => () => {});
  gate.choose('medium');
  assert.equal(await gate.prediction, 'medium');
});