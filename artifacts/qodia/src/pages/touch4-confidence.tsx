import { useEffect, useRef } from 'react';
import type { ConfidenceLevel } from './confidence-calibration';
import s from './Touch4Confidence.module.css';

const choices: { label: string; level: ConfidenceLevel; range: string }[] = [
  { label: 'مو متأكد', level: 'low', range: '٠–٣٣٪' },
  { label: 'يمكن', level: 'medium', range: '٣٤–٦٦٪' },
  { label: 'واثق', level: 'high', range: '٦٧–١٠٠٪' },
  { label: 'متأكد تماماً', level: 'high', range: '١٠٠٪' },
];

export function Touch4CalibrationReaction({ text }: { text: string }) {
  return <p className={s.reaction} role="status" data-testid="text-calibration-reaction">{text}</p>;
}

export function Touch4ConfidencePrompt({ onChoose }: { onChoose: (level: ConfidenceLevel | null) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); };
  }, []);
  return <dialog ref={dialog} className={s.dialog} dir="rtl"
    aria-labelledby="touch4-confidence-title" aria-describedby="touch4-confidence-note"
    data-testid="dialog-touch4-confidence"
    onCancel={event => { event.preventDefault(); onChoose(null); }}>
    <span className={s.eyebrow}>قبل ما نوريك النتيجة...</span>
    <h2 id="touch4-confidence-title">كم واثق إنك كتبت الكود صح؟</h2>
    <div className={s.choices}>
      {choices.map((choice, index) => <button key={choice.label} type="button"
        data-testid={`button-code-confidence-${index}`} onClick={() => onChoose(choice.level)}>
        <strong>{choice.label}</strong><small>{choice.range}</small>
      </button>)}
    </div>
    <p id="touch4-confidence-note">اختيارك ما بيغيّر النقاط أو الفحص. إذا ما اخترت، بنتابع تلقائياً بعد ٣ ثواني.</p>
    <button type="button" className={s.skip} onClick={() => onChoose(null)} data-testid="button-skip-code-confidence">شوف النتيجة بدون توقع</button>
  </dialog>;
}