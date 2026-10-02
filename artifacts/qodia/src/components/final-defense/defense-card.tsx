import { ArrowLeft, Gavel, RotateCcw } from 'lucide-react';
import { Link } from 'wouter';
import { getGetDefenseSummaryQueryKey, useGetDefenseSummary } from '@workspace/api-client-react';
import '@/pages/final-defense.css';

export function DefenseDashboardCard() {
  const summary = useGetDefenseSummary({ query: { queryKey: getGetDefenseSummaryQueryKey() } });
  const s = summary.data;
  const ar = (n: number) => n.toLocaleString('ar-EG');
  return <section className="fd-dash-card" aria-label="المناقشة النهائية" data-testid="card-defense-summary">
    <div className="fd-dash-icon" aria-hidden="true"><Gavel size={24} /></div>
    <div className="fd-dash-body">
      <span className="eyebrow">محاكاة لجنة افتراضية</span>
      <h2>المناقشة النهائية</h2>
      {summary.isLoading ? <div className="skeleton" style={{ width: 240, height: 14 }} role="status" aria-label="جارٍ تحميل ملخص المناقشة" />
        : summary.isError || !s ? <p role="alert">تعذّر تحميل الملخص. <button type="button" className="fd-link" onClick={() => { void summary.refetch(); }} data-testid="button-retry-defense-summary"><RotateCcw size={13} /> حاول مجدداً</button></p>
        : <>
          <p data-testid="text-defense-summary">{s.total_attempts > 0 ? `${ar(s.total_attempts)} محاولة، أفضل نتيجة ${s.best_score === null ? '—' : ar(s.best_score)} من ١٠٠ (تقديرية).` : s.eligible ? 'يمكنك بدء أول محاكاة تدريبية.' : (s.warning ?? `أكملت ${ar(s.completed_concepts)} من ${ar(s.total_concepts)} مفهوماً.`)}</p>
          <p data-testid="text-defense-last-attempt">آخر محاولة: {s.last_attempt_at
            ? <time dateTime={s.last_attempt_at}>{new Date(s.last_attempt_at).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' })}</time>
            : 'لا توجد محاولات بعد.'}</p>
          {s.latest_active && <p>لديك محاكاة غير مكتملة تنتظرك.</p>}
        </>}
    </div>
    <Link href="/final-defense" className="btn btn-outline" data-testid="link-final-defense">{s?.latest_active ? 'أكمل المحاكاة' : 'افتح المناقشة'} <ArrowLeft size={16} /></Link>
  </section>;
}
