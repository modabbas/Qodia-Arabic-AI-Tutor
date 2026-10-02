import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LoaderCircle, Play } from 'lucide-react';
import { Link, useLocation, useSearch } from 'wouter';
import {
  getGetCurrentUserQueryKey, getGetDefenseQueryKey, getGetDefenseSummaryQueryKey, useAbandonDefense, useGetCurrentUser,
  useGetDefenseSummary, useStartDefense, type DefenseSimulation,
} from '@workspace/api-client-react';
import { Brand, ErrorState, LoadingState } from '@/components/qodia-ui';
import { Arena } from '@/components/final-defense/arena';
import { Disclaimer, ar } from '@/components/final-defense/verdict';
import './final-defense.css';

export default function FinalDefense() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const me = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const summary = useGetDefenseSummary({ query: { queryKey: getGetDefenseSummaryQueryKey(), staleTime: 0, refetchOnMount: 'always' } });
  const start = useStartDefense(); const abandon = useAbandonDefense();
  const search = useSearch();
  const rawId = new URLSearchParams(search).get('simulation');
  const simId = rawId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId) ? rawId : null;
  const setSimId = (id: string | null) => navigate(id ? `/final-defense?simulation=${encodeURIComponent(id)}` : '/final-defense');
  const [askedResume, setAskedResume] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = summary.data;
  const userId = me.data?.user.id ?? 'user';

  const begin = () => {
    setError(null);
    start.mutate(undefined, {
      onSuccess: (sim: DefenseSimulation) => { qc.setQueryData(getGetDefenseQueryKey(sim.id), sim); void qc.invalidateQueries({ queryKey: getGetDefenseSummaryQueryKey() }); setAskedResume(true); setSimId(sim.id); },
      onError: () => { setAskedResume(false); void qc.invalidateQueries({ queryKey: getGetDefenseSummaryQueryKey() }); setError('تعذّر بدء المحاكاة. إن كانت هناك محاولة نشطة فستظهر لك لإكمالها، وإلا حاول مرة ثانية.'); },
    });
  };
  const abandonThenBegin = () => {
    if (!s?.latest_active) return begin();
    abandon.mutate({ id: s.latest_active.id }, { onSuccess: () => { setAskedResume(true); begin(); }, onError: () => setError('تعذّر إنهاء المحاكاة السابقة. حاول مجدداً.') });
  };
  const leaveArena = () => { void qc.invalidateQueries({ queryKey: getGetDefenseSummaryQueryKey() }); navigate('/dashboard'); };
  const toEntry = () => { setSimId(null); setAskedResume(true); void qc.invalidateQueries({ queryKey: getGetDefenseSummaryQueryKey() }); };
  const newSim = () => { setAskedResume(true); begin(); };

  const top = <div className="shell fd-top"><Brand /><span className="fd-virtual">لجنة افتراضية</span></div>;
  let body;
  const resumePrompt = !!s?.latest_active && s.latest_active.status === 'active' && !askedResume && (!simId || s.latest_active.id === simId);
  if (simId && !resumePrompt && (s || summary.isError)) body = <Arena key={simId} simId={simId} userId={userId} onLeave={leaveArena} onNew={newSim} />;
  else if (summary.isLoading || (simId && !s && !summary.isError)) body = <LoadingState label="نحضّر قاعة المناقشة..." />;
  else if (summary.isError || !s) body = <ErrorState retry={() => { void summary.refetch(); }} />;
  else if (resumePrompt && s.latest_active) body = <div className="fd-center" data-testid="section-resume">
    <span className="eyebrow">محاكاة غير مكتملة</span><h1>تريد إكمال المحاكاة؟</h1>
    <p className="fd-sub">أجبت عن {ar(s.latest_active.answered_count)} من ٥ أسئلة. المؤقت والإجابات المقفلة محفوظة على الخادم.</p>
    {error && <p className="fd-error" role="alert">{error}</p>}
    <div className="fd-actions"><button className="btn btn-primary" onClick={() => { setAskedResume(true); setSimId(s.latest_active!.id); }} data-testid="button-resume"><Play size={17} /> إكمال المحاكاة</button>
      <button className="btn fd-btn-danger" onClick={abandonThenBegin} disabled={abandon.isPending || start.isPending} data-testid="button-abandon-new">{abandon.isPending || start.isPending ? <LoaderCircle size={17} className="animate-spin" /> : null} إنهاؤها وبدء محاكاة جديدة</button></div>
  </div>;
  else body = <div className="fd-center" data-testid="section-entry">
    <span className="eyebrow">محاكاة لحظة الحقيقة / لجنة افتراضية</span>
    <h1>المناقشة النهائية</h1>
    <p className="fd-sub">لجنة افتراضية تسألك عن ملفات مشروعك الحقيقية ومفاهيمك المتعلَّمة.</p>
    <div className="fd-facts">
      <div className="fd-fact"><span>مشروعك</span><strong data-testid="text-defense-project">{s.project_name ?? 'غير محدد'}</strong></div>
      <div className="fd-fact"><span>التقنية</span><strong>{s.tech_stack ?? 'غير محددة'}</strong></div>
      <div className="fd-fact"><span>المفاهيم المدروسة</span><strong>{ar(s.completed_concepts)} / {ar(s.total_concepts)}</strong></div>
      <div className="fd-fact"><span>جاهزيتك الحالية (متوسط الإتقان)</span><strong>{s.average_mastery === null ? '—' : `${ar(Math.round(s.average_mastery))}٪`}</strong></div>
      <div className="fd-fact"><span>الملفات المحفوظة</span><strong>{ar(s.completed_files)}</strong></div>
      <div className="fd-fact"><span>المحاولات / أفضل نتيجة</span><strong>{ar(s.total_attempts)} / {s.best_score === null ? '—' : ar(s.best_score)}</strong></div>
    </div>
    <div className="fd-rules"><span>٥ أسئلة</span><span>٦٠ ثانية لكل سؤال</span><span>لا تلميحات</span><span>لا إعادة</span></div>
    {(s.warning || !s.eligible || s.no_saved_files) && <p className="fd-note" data-testid="text-defense-warning">{s.warning ?? (s.no_saved_files ? 'لا توجد ملفات مشروع محفوظة بعد.' : 'تحتاج إكمال ١٠ مفاهيم على الأقل.')}</p>}
    {error && <p className="fd-error" role="alert" data-testid="text-start-error">{error}</p>}
    <div className="fd-actions">
      <button className="btn btn-primary" onClick={begin} disabled={!s.eligible || start.isPending} title={s.eligible ? undefined : 'تحتاج إكمال ١٠ مفاهيم على الأقل'} data-testid="button-start-defense">{start.isPending ? <LoaderCircle size={17} className="animate-spin" /> : <Play size={17} />} ابدأ المناقشة</button>
      <Link href="/dashboard" className="btn btn-outline" data-testid="link-postpone">أجّل حتى أكمل المفاهيم <ArrowLeft size={16} /></Link>
    </div>
    <div style={{ maxWidth: 560 }}><Disclaimer source="gemini" /></div>
  </div>;

  return <div className="fd-stage">{top}<main className="shell fd-main">{body}</main></div>;
}
