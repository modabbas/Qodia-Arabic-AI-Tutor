import { useRef, useState } from 'react';
import { LoaderCircle, LockKeyhole } from 'lucide-react';
import { useRevealTouch4Hint, type Touch4Support } from '@workspace/api-client-react';
import s from './Touch4Hints.module.css';
import { hintButtonState, hintCanDisplay } from './hint-controls';

const ar = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

export function Touch4HintProgress({ support, attempts }: { support?: Touch4Support; attempts: number }) {
  const used = support?.hints_used ?? 0;
  const penalty = support?.xp_penalty ?? 0;
  return <div className={s.progressBlock}>
    <div className={s.summary} data-testid="text-hint-progress">
      <span>التلميحات المستخدمة: {ar(used)}/٣ · محاولة {ar(attempts)}</span>
      <span className={penalty ? s.penalty : s.muted} data-testid="text-hint-penalty">
        {penalty ? `الخصم الحالي: −${ar(penalty)} XP` : 'الخصم الحالي: ٠ XP'}
      </span>
    </div>
    <div className={s.track} role="progressbar" aria-label="التلميحات المستخدمة" aria-valuemin={0} aria-valuemax={3} aria-valuenow={used}>
      <div className={s.fill} style={{ width: `${used / 3 * 100}%` }} />
    </div>
  </div>;
}

type ButtonProps = {
  support?: Touch4Support;
  lessonId: string;
  busy: boolean;
  completed: boolean;
  loadError: boolean;
  onBusy: (busy: boolean) => void;
  onState: (support: Touch4Support) => void;
  onRefresh: () => Promise<unknown>;
  onSelect: (level: number) => void;
};

export function Touch4HintButton({ support, lessonId, busy, completed, loadError, onBusy, onState, onRefresh, onSelect }: ButtonProps) {
  const reveal = useRevealTouch4Hint();
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [pendingLevel, setPendingLevel] = useState<number | null>(null);
  const used = support?.hints_used ?? 0;
  const exhausted = used === 3;
  const canShowSolution = !!support && !completed && !support.build_saved && !support.solution_viewed && exhausted;

  async function showHint(level?: number) {
    if (lock.current || busy) return;
    if (level !== undefined) {
      if (hintButtonState(support, level, completed) === 'locked') return;
      const existing = support?.revealed_hints.find(hint => hint.level === level && hintCanDisplay(hint));
      if (existing) { setError(''); onSelect(level); return; }
    } else if (!canShowSolution) return;
    lock.current = true;
    setPendingLevel(level ?? 0);
    onBusy(true);
    setError('');
    try {
      const updated = await reveal.mutateAsync({ data: {
        lesson_id: lessonId, kind: level === undefined ? 'solution' : 'hint',
        ...(level !== undefined ? { level } : {}),
      } });
      onState(updated);
      if (level !== undefined) onSelect(level);
    } catch (failure) {
      const body = (failure as { data?: { error?: string } }).data;
      setError(body?.error ?? 'ما قدرنا نحمّل التلميح هالمرة. ما انخصمت أي نقاط إضافية؛ فيك تحاول مرة تانية.');
      await onRefresh();
    } finally {
      lock.current = false;
      setPendingLevel(null);
      onBusy(false);
    }
  }

  return <>
    <div className={s.buttons} role="group" aria-label="التلميحات المتسلسلة">
      {[1, 2, 3].map(level => {
        const state = hintButtonState(support, level, completed);
        return <button key={level} type="button"
          className={`${s.button} ${state !== 'locked' ? s.available : ''}`}
          disabled={busy || reveal.isPending || state === 'locked'}
          onClick={state === 'locked' ? undefined : () => { void showHint(level); }}
          aria-busy={pendingLevel === level} data-testid={`button-hint-${level}`} data-hint-state={state}
          title={state === 'locked' ? `يحتاج التلميح ${ar(level)} ${ar(level)} محاولات فاشلة وفتح التلميحات السابقة، ومحاولة جديدة بعد آخر تلميح.` : state === 'unlocked' ? 'عرض مجدداً بدون خصم إضافي.' : undefined}>
          {pendingLevel === level ? <LoaderCircle className={s.spinner} size={14} aria-hidden="true" />
            : state === 'locked' ? <LockKeyhole size={13} aria-hidden="true" /> : null}
          تلميح {ar(level)}{state === 'unlocked' ? ' — راجع' : state === 'available' ? ' (−١٠ XP)' : ''}
        </button>;
      })}
      {canShowSolution && <button type="button" className={`${s.button} ${s.exhausted}`}
        disabled={busy || reveal.isPending} onClick={() => { void showHint(); }}
        aria-busy={pendingLevel === 0} data-testid="button-reference-solution">
        {pendingLevel === 0 ? <LoaderCircle className={s.spinner} size={14} aria-hidden="true" /> : null}
        عرض الحل النموذجي (−٢٠ XP إضافية)
      </button>}
    </div>
    {loadError && <button className={s.retry} type="button" disabled={busy} onClick={() => { void onRefresh(); }}>إعادة تحميل التلميحات</button>}
    {error && <span className={s.requestError} role="alert" data-testid="status-hint-error">{error}</span>}
  </>;
}

export function Touch4HintCards({ support, completed, selectedLevel }: { support?: Touch4Support; completed: boolean; selectedLevel?: number }) {
  if (!support) return null;
  const revealed = support.revealed_hints.filter(hint => hint.level <= support.hints_used && hintCanDisplay(hint))
    .sort((a, b) => a.level - b.level);
  const currentHint = revealed.find(hint => hint.level === selectedLevel) ?? revealed.at(-1);
  return <div aria-live="polite" className={s.cards}>
    {!completed && !support.build_saved && !support.solution_viewed && !support.can_reveal_next && support.hints_used < 3 &&
      <p className={s.help} data-testid="text-hint-lock">
        {support.hints_used === 0
          ? 'جرّب كتابة الكود أولاً؛ التلميح بيصير متاح بعد محاولة ما بتجتاز الفحص.'
          : 'جرّب تعدّل الكود حسب التلميح. إذا الفحص ما مرّ، التلميح التالي بيصير متاح.'}
      </p>}
    {currentHint && <section className={s.card} key={currentHint.level} data-testid={`card-hint-${currentHint.level}`}>
      <h3>تلميح {ar(currentHint.level)}/٣{currentHint.level === 3 ? ' — الأخير' : ''}</h3>
      <p>{currentHint.text_ar}</p>
      {currentHint.level !== 3 && currentHint.example && <p>مثال: {currentHint.example}</p>}
      {currentHint.level !== 3 && currentHint.code_example && <pre dir="ltr"><code>{currentHint.code_example}</code></pre>}
      <small>خصم هالتلميح: −١٠ XP، محسوب ضمن المجموع.</small>
    </section>}
    {support.solution_viewed && support.reference_solution && <section className={s.card} data-testid="card-reference-solution">
      <h3>الحل النموذجي — اقرأه وجرّب تكتبه بطريقتك</h3>
      <pre dir="ltr"><code>{support.reference_solution}</code></pre>
      <small>المجموع: −٥٠ XP. مشاهدة الحل ما بتتجاوز فحص الكود؛ لسه لازم تحاول وتنجح.</small>
    </section>}
    {completed && support.first_try_bonus === 50 && <section className={s.hero} data-testid="status-first-try-hero">
      <strong>نجحت من أول محاولة!</strong><span>مكافأة إضافية: +٥٠ XP</span>
    </section>}
  </div>;
}