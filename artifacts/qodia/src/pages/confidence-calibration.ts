export type ConfidenceLevel = 'low' | 'medium' | 'high';
export const CONFIDENCE_DECISION_MS = 3_000;

export function getCalibrationReaction(confidence: ConfidenceLevel, wasCorrect: boolean): string {
  if (confidence === 'high' && wasCorrect) return 'كنت متأكد ومحقق! 🎯';
  if (confidence === 'low' && wasCorrect) return 'أنت أفضل مما تتوقع! 🎉';
  if (confidence === 'high' && !wasCorrect) return 'لحظة تعلم قوية 💡';
  if (confidence === 'low' && !wasCorrect) return 'توقعك كان دقيق، خلينا نفهمها سوا';
  if (confidence === 'medium' && wasCorrect) return 'تمام، كان توقعك بمكانه ✓';
  return 'قريب، خلينا نشوف وين الفرق';
}

type Schedule = (expire: () => void, delay: number) => () => void;
const schedule: Schedule = (expire, delay) => {
  const timer = globalThis.setTimeout(expire, delay);
  return () => globalThis.clearTimeout(timer);
};

/** A skipped/expired prediction is unknown, never an invented medium answer. */
export function createConfidenceGate(startTimer: Schedule = schedule) {
  let settled = false;
  let resolve!: (level: ConfidenceLevel | null) => void;
  let stopTimer = () => {};
  const prediction = new Promise<ConfidenceLevel | null>(done => { resolve = done; });
  function choose(level: ConfidenceLevel | null) {
    if (settled) return;
    settled = true;
    stopTimer();
    resolve(level);
  }
  stopTimer = startTimer(() => choose(null), CONFIDENCE_DECISION_MS);
  return { prediction, choose };
}