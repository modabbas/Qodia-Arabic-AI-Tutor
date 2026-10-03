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
      <span>التلميحات: {ar(used)}/٣ · محاولات {ar(attempts)}</span>
      <span className={penalty ? s.penalty : s.muted} data-testid="text-hint-penalty">
        {penalty ? `الخصم: −${ar(penalty)} XP` : 'الخصم: ٠ XP'}
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
  const solutionSeen = !!support?.solution_viewed && !!support.reference_solution;
  const canShowSolution = !!support && !completed && !support.build_saved && !support.solution_viewed && exhausted;

  async function showHint(level?: number) {
    if (lock.current || busy) return;
    if (level !== undefined) {
      if (hintButtonState(support, level, completed) === 'locked') return;
      const existing = support?.revealed_hints.find(hint => hint.level === level && hintCanDisplay(hint));
      if (existing) { setError(''); onSelect(level); return; }
    } else if (solutionSeen) { setError(''); onSelect(0); return; }
    else if (!canShowSolution) return;
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
      onSelect(level ?? 0);
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
          title={state === 'locked' ? `بيتفتح بعد ٣٥ ثانية بدون كتابة أو بعد محاولة فاشلة جديدة، وبعد فتح اللي قبله.` : state === 'unlocked' ? 'عرض مجدداً بدون خصم إضافي.' : undefined}>
          {pendingLevel === level ? <LoaderCircle className={s.spinner} size={14} aria-hidden="true" />
            : state === 'locked' ? <LockKeyhole size={13} aria-hidden="true" /> : null}
          تلميح {ar(level)}{state === 'unlocked' ? ' — راجع' : state === 'available' ? ' (−١٠ XP)' : support && level === used + 1 ? ' (قريباً)' : ''}
        </button>;
      })}
      {(canShowSolution || solutionSeen || !completed) && <button type="button" className={`${s.button} ${canShowSolution || solutionSeen ? s.exhausted : ''}`}
        disabled={busy || reveal.isPending || !(canShowSolution || solutionSeen)} onClick={() => { void showHint(); }}
        aria-busy={pendingLevel === 0} data-testid="button-reference-solution" data-hint-state={solutionSeen ? 'unlocked' : canShowSolution ? 'available' : 'locked'}>
        {pendingLevel === 0 ? <LoaderCircle className={s.spinner} size={14} aria-hidden="true" /> : !(canShowSolution || solutionSeen) ? <LockKeyhole size={13} aria-hidden="true" /> : null}
        {solutionSeen ? 'الحل النموذجي — راجع' : 'الحل (−٢٠ XP)'}
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
  const solutionReady = support.solution_viewed && !!support.reference_solution;
  const showSolution = solutionReady && (selectedLevel === 0 || selectedLevel === undefined);
  const currentHint = showSolution ? undefined : revealed.find(hint => hint.level === selectedLevel) ?? revealed.at(-1);
  const idle = !showSolution && !currentHint;
  return <div aria-live="polite" className={s.cards}>
    {idle && <div className={s.idle} data-testid="text-help-idle"><strong>المساعدة جاهزة لما تحتاجها</strong>
      <p>جرّب تكتب أول خطوة بنفسك. إذا علقت، افتح التلميح ١ — بيخصم ١٠ XP فقط.</p></div>}
    {currentHint && <section className={s.card} key={currentHint.level} data-testid={`card-hint-${currentHint.level}`}>
      <h3>تلميح {ar(currentHint.level)}/٣{currentHint.level === 3 ? ' — الأخير' : ''}</h3>
      <p>{currentHint.text_ar}</p>
      {currentHint.level !== 3 && currentHint.example && <p>مثال: {currentHint.example}</p>}
      {currentHint.level !== 3 && currentHint.code_example && <pre dir="ltr"><code>{currentHint.code_example}</code></pre>}
      <small>خصم هالتلميح: −١٠ XP، ومراجعته مجانية.</small>
    </section>}
    {showSolution && <section className={s.card} key="solution" data-testid="card-reference-solution">
      <h3>الحل النموذجي — اقرأه وجرّب تكتبه بطريقتك</h3>
      <pre dir="ltr"><code>{support.reference_solution}</code></pre>
      <small>المجموع: −٥٠ XP. مراجعة الحل مجانية، ومشاهدته ما بتتجاوز فحص الكود؛ لسه لازم تحاول وتنجح.</small>
    </section>}
    {completed && support.first_try_bonus === 50 && <section className={s.hero} data-testid="status-first-try-hero">
      <strong>نجحت من أول محاولة!</strong><span>مكافأة إضافية: +٥٠ XP</span>
    </section>}
  </div>;
}

type PanelProps = Omit<ButtonProps, 'support'> & {
  support?: Touch4Support; selectedLevel?: number; activityError: boolean; onRetryActivity: () => void;
};

export function Touch4HelpPanel({ support, selectedLevel, activityError, onRetryActivity, ...rest }: PanelProps) {
  const used = support?.hints_used ?? 0;
  const closed = rest.completed || !!support?.build_saved || !!support?.solution_viewed;
  const shown = selectedLevel === 0 ? '٤' : ar(Math.min(3, selectedLevel ?? used));
  let note = 'التلميح ١ جاهز من البداية، ما تحتاج تحاول أول.';
  if (!support) note = rest.loadError ? 'ما قدرنا نحمّل حالة التلميحات.' : 'عم نحمّل التلميحات...';
  else if (closed || used === 3) note = used === 3 ? 'استخدمت التلميحات الثلاثة. الحل متاح إذا احتجته.' : 'المراجعة مجانية.';
  else if (used > 0 && !support.can_reveal_next) note = 'التلميح التالي بيتفتح بعد ٣٥ ثانية بدون كتابة، أو بعد محاولة فاشلة جديدة.';
  else if (used > 0) note = 'التلميح التالي صار متاح.';
  return <aside className={s.panel} aria-label="لوحة المساعدة" data-testid="panel-touch4-help">
    <div className={s.panelHead}>
      <span className={s.crumb} data-testid="text-hint-breadcrumb">{selectedLevel === 0 ? 'الحل النموذجي' : used === 0 ? 'جاهز' : `${shown}/٣`}</span>
      <span className={s.panelTitle}>مساعدة</span>
    </div>
    <Touch4HintProgress support={support} attempts={support?.attempts ?? 0} />
    <Touch4HintButton {...rest} support={support} />
    <p className={s.help} data-testid="text-hint-timing">{note}</p>
    {activityError && <p className={s.requestError} role="alert" data-testid="status-activity-error">ما قدرنا نحدّث توقيت التلميح. التلميح التالي يبقى مقفول لحد ما نتأكد. <button type="button" className={s.retry} onClick={onRetryActivity} data-testid="button-retry-activity">حاول مرة ثانية</button></p>}
    <Touch4HintCards support={support} completed={rest.completed} selectedLevel={selectedLevel} />
  </aside>;
}
