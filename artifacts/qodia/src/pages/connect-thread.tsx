import { useState } from 'react';
import type { GeneratedConnectThread } from '@workspace/api-client-react';
import s from './connect-thread.module.css';

type Props = { thread: GeneratedConnectThread; secondaryStack: string; onContinue: () => void };
const keys = ['أ', 'ب', 'ج'];

export default function ConnectThread({ thread, secondaryStack, onContinue }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const options = thread.options.slice(0, 3);
  const choice = picked === null ? null : options[picked];

  return (
    <section className={s.screen} dir="rtl" lang="ar" data-testid="connect-thread-screen" aria-labelledby="connect-thread-title">
      <div className={s.badges}>
        <span className={s.badge}>اختياري</span>
        <span className={`${s.badge} ${s.muted}`}>بدون تقييم</span>
        {secondaryStack && <span className={`${s.badge} ${s.muted}`} dir="auto">{secondaryStack}</span>}
      </div>
      <h2 id="connect-thread-title" className={s.title}>وصل الخيط</h2>
      <p className={s.intro}>{thread.intro_ar}</p>
      <pre className={s.code} tabIndex={0} role="region" aria-label="مثال برمجي" data-testid="connect-thread-code"><code>{thread.integration_snippet}</code></pre>
      <p className={s.q} id="connect-thread-q">{thread.comprehension_question_ar}</p>
      <div className={s.opts} role="group" aria-labelledby="connect-thread-q">
        {options.map((o, i) => {
          const state = picked === null ? '' : o.correct ? s.right : i === picked ? s.wrong : s.dim;
          return (
            <button key={i} type="button" className={`${s.opt} ${state}`} disabled={picked !== null}
              aria-pressed={picked === i} onClick={() => picked === null && setPicked(i)}
              data-testid={`button-connect-thread-option-${i}`}>
              <span className={s.key} aria-hidden="true">{keys[i]}</span>
              <span>{o.text_ar}</span>
            </button>
          );
        })}
      </div>
      <div className={s.fb} role="status" data-testid="status-connect-thread-feedback">
        {choice && (choice.correct
          ? <span className={s.fbok}>إجابة صحيحة. الخيط اتوصل.</span>
          : <span className={s.fbno}>مو هذا الاختيار. راجع المثال أعلاه ثم تابع.</span>)}
      </div>
      <div className={s.actions}>
        <button type="button" className={s.go} disabled={picked === null} onClick={onContinue} data-testid="button-connect-thread-continue">متابعة</button>
        <button type="button" className={s.skip} onClick={onContinue} data-testid="button-connect-thread-skip">تخطّي</button>
      </div>
    </section>
  );
}
