import { ArrowLeft, ArrowUpLeft, CalendarDays, Flame, Layers3, LoaderCircle, Sparkles } from 'lucide-react';
import { Link } from 'wouter';
import { getGetGeneratedSessionQueryKey, useGetDashboard, useGetGeneratedSession, useGetSessions } from '@workspace/api-client-react';
import { AppHeader, ErrorState, LoadingState } from '@/components/qodia-ui';

export default function Dashboard() {
  const dashboard = useGetDashboard();
  const sessions = useGetSessions();
  const challenge = useGetGeneratedSession({ query: { enabled: !!dashboard.data, queryKey: getGetGeneratedSessionQueryKey() } });
  if (dashboard.isLoading || sessions.isLoading) return <><AppHeader active="dashboard" /><LoadingState /></>;
  if (dashboard.isError || sessions.isError || !dashboard.data) return <><AppHeader active="dashboard" /><ErrorState retry={() => { dashboard.refetch(); sessions.refetch(); }} /></>;
  const { user, progress } = dashboard.data;
  const history = sessions.data ?? dashboard.data.recent_sessions;
  const challengeLoading = challenge.isLoading;
  const preview = challenge.data?.source === 'gemini' ? challenge.data : null;
  const challengeTitle = challengeLoading ? 'مشرفك يحضّر تحدّي اليوم...' : preview ? `ليش اخترت ${preview.concept_name_ar}؟` : `تحدّي ${user.tech_stack || 'البرمجة'} اليومي`;
  const challengeDescription = challengeLoading ? 'خمس لمسات جديدة قادمة' : preview ? preview.concept_intro : `٥ لمسات لتقوية فهمك في مشروع ${user.project_name || 'مشروعك'}`;
  return <div className="min-h-[100dvh]">
    <AppHeader active="dashboard" />
    <main className="shell" style={{ paddingBottom: 110 }}>
      <div className="dash-hero"><div><span className="eyebrow">مساحة التدريب الخاصة فيك</span><h1 data-testid="text-welcome">أهلاً، {user.name.split(' ')[0]}.</h1><p className="muted" style={{ fontSize: 16, lineHeight: 1.8, margin: 0 }}>كل مرة تتدرّب فيها، جوابك يوم المناقشة يصير أوضح.</p></div><div style={{ textAlign: 'right' }}><span className="muted" style={{ fontSize: 12 }}>مشروعك الحالي</span><div style={{ fontSize: 17, marginTop: 6 }} data-testid="text-project-name">{user.project_name || 'لم يُحدّد بعد'}</div><span className="mono" style={{ color: '#22c55e', fontSize: 11 }}>{user.tech_stack}</span></div></div>
      <div className="dash-grid">
        <div className="session-feature"><div><span className="eyebrow">تحدّي اليوم / مفهوم 01</span><h2 data-testid="text-challenge-title">{challengeTitle}</h2><p className="muted" style={{ lineHeight: 1.8, maxWidth: 470 }} data-testid="text-challenge-description">{challengeDescription}</p></div>{challengeLoading ? <div role="status" aria-label="جارٍ تحضير تحدّي اليوم" data-testid="status-challenge-loading" style={{ alignSelf: 'start', marginTop: 20, height: 44, display: 'flex', alignItems: 'center', color: '#74d78e' }}><LoaderCircle size={21} className="animate-spin" aria-hidden="true" /></div> : <Link href="/session" className="btn btn-primary" style={{ alignSelf: 'start', marginTop: 20 }} data-testid="link-start-session">ابدأ جلسة اليوم <ArrowLeft size={17} /></Link>}</div>
        <div className="stat-grid">
          <div className="panel stat"><Flame size={23} color="#e6a66d" /><div><div className="stat-value" data-testid="text-streak">{progress.streak_days}</div><div className="stat-label">أيام متتالية</div></div></div>
          <div className="panel stat"><Sparkles size={23} color="#22c55e" /><div><div className="stat-value" data-testid="text-xp">{progress.total_xp}</div><div className="stat-label">نقطة خبرة XP</div></div></div>
          <div className="panel stat" style={{ gridColumn: '1 / -1', minHeight: 125, flexDirection: 'row', alignItems: 'center' }}><div><div className="stat-label">مستواك الحالي</div><div className="stat-value" data-testid="text-level">{String(progress.level).padStart(2, '0')}</div></div><Layers3 size={31} color="#a8bba9" /></div>
        </div>
      </div>
      <section style={{ marginTop: 68 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 12 }}><div><span className="eyebrow">سجلّك</span><h2 style={{ fontSize: 27, letterSpacing: '-.04em', margin: '9px 0' }}>جلساتك السابقة</h2></div><span className="muted" style={{ fontSize: 12 }}>{history.length} جلسة</span></div>
        {history.length ? <div className="panel" style={{ padding: '8px 26px' }}>{history.map(item => <div className="history-row" key={item.id} data-testid={`row-session-${item.id}`}><div><strong style={{ fontSize: 15 }}>{item.concept}</strong><div className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}><CalendarDays size={13} />{new Date(item.timestamp).toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div><div style={{ textAlign: 'left' }}><span className="mono" style={{ color: '#22c55e', fontSize: 14 }}>+{item.xp_earned} XP</span><div className="muted" style={{ fontSize: 11, marginTop: 5 }}>{item.touches_completed} من ٥ لمسات</div></div></div>)}</div> : <div className="panel" style={{ padding: '45px 30px', display: 'flex', flexDirection: 'column', alignItems: 'start', gap: 12 }} data-testid="status-empty-sessions"><span className="eyebrow">البداية من هنا</span><h3 style={{ fontSize: 23, margin: 0 }}>أول جلسة رح تظهر هون.</h3><p className="muted" style={{ margin: 0 }}>ابدأ التدريب وخلّي تقدّمك يحكي عنك.</p><Link href="/session" style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 7, marginTop: 10 }} data-testid="link-empty-start">ابدأ الآن <ArrowUpLeft size={16} /></Link></div>}
      </section>
    </main>
  </div>;
}