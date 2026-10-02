import { useEffect, useRef, useState } from 'react';
import { Bot } from 'lucide-react';
import type { Touch4FirstMove as Touch4FirstMoveType } from '@workspace/api-client-react';
import s from './Touch4Conversation.module.css';

export function Touch4Mentor({ task, concept }: { task: string; concept: string }) {
  return (
    <div className={s.mentor} data-testid="touch4-mentor" data-concept={concept}>
      <span className={s.avatar} aria-hidden="true"><Bot size={22} /></span>
      <div className={s.bubble}><span className={s.name}>مرشدك</span>{task}</div>
    </div>
  );
}

export function Touch4FirstMove({ choice, onCorrect }: { choice: Touch4FirstMoveType; onCorrect: () => void }) {
  const [wrong, setWrong] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const lockRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);
  const cbRef = useRef(onCorrect);
  cbRef.current = onCorrect;
  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const pick = (id: string, correct: boolean) => {
    if (lockRef.current) return;
    if (!correct) {
      setWrong(w => (w.includes(id) ? w : [...w, id]));
      setMsg('قريب! فكّر تاني');
      return;
    }
    lockRef.current = true;
    setPicked(id);
    setMsg('أحسنت! هيك نبدأ.');
    timerRef.current = window.setTimeout(() => cbRef.current(), 300);
  };

  return (
    <section className={s.move} dir="rtl" data-testid="touch4-first-move">
      <p className={s.question}>{choice.question_ar}</p>
      <div className={s.options}>
        {choice.options.map(o => (
          <button
            key={o.id}
            type="button"
            data-session-option=""
            className={`${s.option} ${wrong.includes(o.id) ? s.wrong : ''} ${picked === o.id ? s.right : ''}`}
            disabled={wrong.includes(o.id) || picked !== null}
            onClick={() => pick(o.id, o.correct)}
            data-testid={`button-first-move-${o.id}`}
          >{o.text_ar}</button>
        ))}
      </div>
      <div className={`${s.feedback} ${picked ? s.feedbackOk : ''}`} role="status" aria-live="polite" data-testid="status-first-move-feedback">{msg}</div>
    </section>
  );
}
