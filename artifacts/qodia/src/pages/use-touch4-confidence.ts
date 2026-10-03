import { useEffect, useRef, useState } from 'react';
import { createConfidenceGate, getCalibrationReaction, type ConfidenceLevel } from './confidence-calibration';

export function useTouch4Confidence(lessonId: string) {
  const [phase, setPhase] = useState<'predicting' | 'waiting' | null>(null);
  const [reaction, setReaction] = useState<string | null>(null);
  const current = useRef<ReturnType<typeof createConfidenceGate> | null>(null);
  useEffect(() => {
    setPhase(null);
    setReaction(null);
    return () => {
      const old = current.current;
      current.current = null;
      old?.choose(null);
    };
  }, [lessonId]);

  function begin() {
    current.current?.choose(null);
    const gate = createConfidenceGate();
    current.current = gate;
    setReaction(null);
    setPhase('predicting');
    void gate.prediction.then(() => {
      if (current.current === gate) setPhase('waiting');
    });
    return {
      prediction: gate.prediction,
      isCurrent: () => current.current === gate,
      reveal: (level: ConfidenceLevel | null, wasCorrect: boolean) => {
        if (current.current === gate) setReaction(level === null ? null : getCalibrationReaction(level, wasCorrect));
      },
      finish: () => {
        if (current.current !== gate) return;
        current.current = null;
        gate.choose(null);
        setPhase(null);
      },
    };
  }
  return {
    begin, phase, reaction,
    choose: (level: ConfidenceLevel | null) => current.current?.choose(level),
    clearReaction: () => setReaction(null),
  };
}