import { useRef, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { useRevealTouch4Hint, type Touch4Support } from '@workspace/api-client-react';
import s from './Touch4Hints.module.css';

const ar = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

export function Touch4HintProgress({ support, attempts }: { support?: Touch4Support; attempts: number }) {
  const used = support?.hints_used ?? 0;
  const penalty = support?.xp_penalty ?? 0;
  return <div className={s.progressBlock}>
    <div className={s.summary} data-testid="text-hint-progress">
      <span>محاولة {ar(attempts)} — تلميحات مستخدمة {ar(used)} / ٣</span>
      <span className={penalty ? s.penalty : s.muted} data-testid="text-hint-penalty">
        {penalty ? `خصم التلميحات: −${ar(penalty)} XP` : 'خصم التلميحات: ٠ XP'}
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
};

export function Touch4HintButton({ support, lessonId, busy, completed, loadError, onBusy, onState, onRefresh }: ButtonProps) {
  const reveal = useRevealTouch4Hint();
  const lock = useRef(false);
  const [error, setError] = useState('');
  const used = support?.hints_used ?? 0;
  const exhausted = used === 3;
  const canReveal = !!support && !completed && !support.build_saved && !support.solution_viewed
    && (exhausted || support.can_reveal_next);

  async function showHint() {
    if (lock.current || busy || completed || !canReveal) return;
    lock.current = true;
    onBusy(true);
    setError('');
    try {
      const updated = await reveal.mutateAsync({ data: {
        lesson_id: lessonId, kind: exhausted ? 'solution' : 'hint',
        ...(!exhausted ? { level: used + 1 } : {}),
      } });
      onState(updated);
    } catch (failure) {
      const body = (failure as { data?: { error?: string } }).data;
      setError(body?.error ?? 'ما قدرنا نحمّل التلميح هالمرة. ما انخصمت أي نقاط؛ فيك تحاول مرة تانية.');
      await onRefresh();
    } finally {
      lock.current = false;
      onBusy(false);
    }
  }

  if (completed || support?.build_saved) return null;
  return <>
    <button type="button" className={`${s.button} ${canReveal ? s.available : ''} ${exhausted ? s.exhausted : ''}`}
      disabled={busy || reveal.isPending || !canReveal} onClick={() => { void showHint(); }}
      aria-busy={reveal.isPending} data-testid="button-hint"
      title={used === 0 && !support?.failed_attempts ? 'جرّب كتابة الكود أولاً، التلميح بيصير متاح بعد محاولة ما بتجتاز الفحص.' : undefined}>
      {reveal.isPending ? <><LoaderCircle className={s.spinner} size={16} aria-hidden="true" /> عم نحضّر التلميح...</>
        : support?.solution_viewed ? 'الحل النموذجي معروض'
          : exhausted ? 'عرض الحل النموذجي (−٢٠ XP إضافية)'
            : !support?.failed_attempts ? 'جرّب أولاً'
              : `تلميح ${ar(used + 1)}/٣ (−١٠ XP)`}
    </button>
    {loadError && <button className={s.retry} type="button" disabled={busy} onClick={() => { void onRefresh(); }}>إعادة تحميل التلميحات</button>}
    {error && <span className={s.requestError} role="alert" data-testid="status-hint-error">{error}</span>}
  </>;
}

export function Touch4HintCards({ support, completed }: { support?: Touch4Support; completed: boolean }) {
  const [review, setReview] = useState<{ lesson: string; used: number; level: number } | null>(null);
  if (!support) return null;
  const currentHint = review?.lesson === support.lesson_id && review.used === support.hints_used
    ? support.revealed_hints.find(item => item.level === review.level)
    : support.revealed_hints.at(-1);
  return <div aria-live="polite" className={s.cards}>
    {!completed && !support.build_saved && !support.solution_viewed && !support.can_reveal_next && support.hints_used < 3 &&
      <p className={s.help} data-testid="text-hint-lock">
        {support.hints_used === 0
          ? 'جرّب كتابة الكود أولاً؛ التلميح بيصير متاح بعد محاولة ما بتجتاز الفحص.'
          : 'جرّب تعدّل الكود حسب التلميح. إذا الفحص ما مرّ، التلميح التالي بيصير متاح.'}
      </p>}
    {support.revealed_hints.length > 1 && <nav className={s.review} aria-label="مراجعة التلميحات المفتوحة">
      <span>راجع تلميح قديم بدون خصم إضافي:</span>
      {support.revealed_hints.map(item => <button key={item.level} type="button"
        aria-pressed={currentHint?.level === item.level}
        onClick={() => setReview({ lesson: support.lesson_id, used: support.hints_used, level: item.level })}
        data-testid={`button-review-hint-${item.level}`}>تلميح {ar(item.level)}</button>)}
    </nav>}
    {currentHint && <section className={s.card} key={currentHint.level} data-testid={`card-hint-${currentHint.level}`}>
      <h3>تلميح {ar(currentHint.level)}/٣{currentHint.level === 3 ? ' — الأخير' : ''}</h3>
      <p>{currentHint.text_ar}</p>
      {currentHint.example && <p>مثال: {currentHint.example}</p>}
      {currentHint.code_example && <pre dir="ltr"><code>{currentHint.code_example}</code></pre>}
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