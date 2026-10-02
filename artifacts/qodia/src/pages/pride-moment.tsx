import { useEffect, useRef, type ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';
import type { PrideMoment as PrideMomentData } from '@workspace/api-client-react';
import { CountUp } from './session-fx';
import { anticipationDistance, arabicCount, milestoneLabel, nextMilestoneDistance, shouldShowPrideMoment } from './pride-moment-rules';
import s from './PrideMoment.module.css';

export function PrideAnticipation({ completed }: { completed: number }) {
  const distance = anticipationDistance(completed);
  return distance === null ? null : <span className={s.badge} data-testid="badge-pride-countdown">
    <LockKeyhole size={12} aria-hidden="true" />
    إنجاز خاص خلال {distance === 2 ? 'جلستين' : 'جلسة وحدة'}
  </span>;
}

export function PrideMoment({ data, reduced, renderCode, onUnlock }: {
  data: PrideMomentData; reduced: boolean; renderCode: (code: string) => ReactNode; onUnlock: () => void;
}) {
  const unlock = useRef(onUnlock);
  unlock.current = onUnlock;
  const milestone = shouldShowPrideMoment(data.completed_sessions_count);
  useEffect(() => {
    if (!milestone) return;
    const timer = window.setTimeout(() => unlock.current(), 650);
    return () => window.clearTimeout(timer);
  }, [milestone]);
  if (!milestone) return null;
  const { comparison, completed_sessions_count: count } = data;
  return <section className={s.card} data-reduced={reduced} data-testid="card-pride-moment" aria-labelledby="pride-heading">
    <h2 id="pride-heading">🏆 شوف وين وصلت</h2>
    <span className={s.session}>إنجاز {arabicCount(count)} جلسات مكتملة</span>
    {comparison ? <>
      <div className={s.comparison}>
        <div>
          <h3>أول ملف حفظته (اليوم ١)</h3>
          <pre dir="ltr" data-testid="code-pride-first"><code>{renderCode(comparison.first.preview)}</code></pre>
          <p className={s.caption}><bdi dir="ltr">{comparison.first.path}</bdi> · {comparison.first.modified_since_creation ? 'نسخة الملف المحفوظة حالياً، مو أرشيف أول كتابة' : 'كودك المحفوظ، من أول ملف بالمشروع'}</p>
        </div>
        <div>
          <h3>آخر كود كتبته (اليوم {arabicCount(comparison.latest.day)})</h3>
          <pre dir="ltr" data-testid="code-pride-latest"><code>{renderCode(comparison.latest.preview)}</code></pre>
          <p className={s.caption}><bdi dir="ltr">{comparison.latest.path}</bdi> · من الجلسة اللي خلّصتها هلأ</p>
        </div>
      </div>
      <p className={s.lines} data-testid="text-pride-lines">
        {comparison.latest.line_count > comparison.first.line_count ? 'من ' : 'أول ملف: '}
        <b><CountUp value={comparison.first.line_count} duration={450} reduced={reduced} /></b> سطر كود
        {comparison.latest.line_count > comparison.first.line_count ? ' إلى ' : ' · هالجلسة: '}
        <b><CountUp value={comparison.latest.line_count} duration={450} reduced={reduced} /></b> سطر
      </p>
      <p className={s.caption}>{comparison.latest.line_count > comparison.first.line_count
        ? 'خطوة ورا خطوة. هيك بتبني مشروع تخرجك.'
        : 'التقدم مو بس عدد الأسطر. كل جلسة بتزيد فهمك للكود اللي عم تكتبه.'}</p>
    </> : <p className={s.caption} data-testid="text-pride-no-code">إنجازك محفوظ. ما في كود محفوظ كافي لهالمقارنة، وما رح نعرض كود مو إلك.</p>}
    <p className={s.identity} data-testid="text-pride-identity">{milestoneLabel(count)}</p>
    <p className={s.hook} data-testid="text-pride-next">كمان {arabicCount(nextMilestoneDistance(count))} جلسات وبتشوف مقارنة جديدة 🚀</p>
    <p className={s.share}>📸 خذ لقطة شاشة وشاركها</p>
  </section>;
}