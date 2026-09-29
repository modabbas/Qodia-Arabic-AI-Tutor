import { useState } from 'react';
import { ArrowLeft, Code2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCurrentUserQueryKey, getGetDashboardQueryKey, useCompleteOnboarding, type TechStack } from '@workspace/api-client-react';
import { Brand } from '@/components/qodia-ui';

const stacks: TechStack[] = ['Django', 'Node.js', 'React', 'Flutter'];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const mutation = useCompleteOnboarding();
  const [project, setProject] = useState('');
  const [stack, setStack] = useState<TechStack | ''>('');
  const [error, setError] = useState('');
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stack || !project.trim()) return;
    setError('');
    mutation.mutate({ data: { project_name: project.trim(), tech_stack: stack } }, {
      onSuccess: async (user) => {
        queryClient.setQueryData(getGetCurrentUserQueryKey(), { user });
        await queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        navigate('/dashboard');
      },
      onError: () => setError('ما قدرنا نحفظ تفاصيل مشروعك. حاول مرة ثانية.'),
    });
  }
  return <div className="min-h-[100dvh]">
    <header className="shell site-header"><Brand /><span className="mono muted" style={{ fontSize: 11 }}>SETUP / 01</span></header>
    <main className="shell" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '8%', alignItems: 'center', minHeight: 'calc(100dvh - 82px)', paddingBlock: 65 }}>
      <div><span className="eyebrow">خلّينا نتعرّف على شغلك</span><h1 className="section-title" style={{ margin: '17px 0' }}>كل تدريب قوي يبدأ من <span style={{ color: '#22c55e' }}>مشروعك.</span></h1><p className="muted" style={{ lineHeight: 1.9, maxWidth: 430 }}>ما بدنا نختبرك بمعلومات بعيدة عنك. قول لنا شو عم تبني، ونبدأ من المفاهيم اللي تهمّك فعلاً.</p><div className="panel" style={{ marginTop: 42, padding: 23, maxWidth: 420, display: 'flex', gap: 17, alignItems: 'start' }}><Code2 size={23} color="#22c55e" /><div><strong>أول تحدّي جاهز</strong><p className="muted" style={{ fontSize: 13, lineHeight: 1.8, margin: '5px 0 0' }}>ForeignKey و on_delete في Django — خمس لمسات بينك وبين جواب أوضح.</p></div></div></div>
      <form className="panel" onSubmit={submit} style={{ padding: 'clamp(24px, 4vw, 42px)' }}>
        <span className="eyebrow">بطاقة المشروع</span><h2 style={{ fontSize: 27, letterSpacing: '-.04em', margin: '15px 0 29px' }}>عن شو مشروع تخرّجك؟</h2>
        <div style={{ marginBottom: 27 }}><label htmlFor="project" className="field-label">اسم المشروع</label><input id="project" className="field" placeholder="مثلاً: نظام إدارة عيادة" required minLength={1} maxLength={120} value={project} onChange={e => setProject(e.target.value)} data-testid="input-project-name" /></div>
        <label className="field-label" htmlFor="stack">التقنية الأساسية</label>
        <select id="stack" className="field" value={stack} onChange={e => setStack(e.target.value as TechStack)} required data-testid="select-tech-stack"><option value="" disabled>اختر التقنية</option>{stacks.map(item => <option key={item} value={item}>{item}</option>)}</select>
        <p className="muted" style={{ fontSize: 12, lineHeight: 1.8, marginTop: 13 }}>حالياً تدريبنا الأول على Django. تقدر تبدأ فيه مهما كانت تقنية مشروعك.</p>
        {error && <div className="error-note" role="alert" style={{ marginTop: 20 }} data-testid="status-onboarding-error">{error}</div>}
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 26 }} disabled={mutation.isPending || !stack || !project.trim()} data-testid="button-save-project">{mutation.isPending ? 'عم نحفظ مشروعك...' : 'جهّز مساحتي'} <ArrowLeft size={17} /></button>
      </form>
    </main>
  </div>;
}