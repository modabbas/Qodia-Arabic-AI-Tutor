import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCurrentUserQueryKey, getGetDashboardQueryKey, getGetSessionsQueryKey, useLogIn, useSignUp } from '@workspace/api-client-react';
import { Brand } from '@/components/qodia-ui';

export default function AuthPage({ mode }: { mode: 'signup' | 'login' }) {
  const isSignup = mode === 'signup';
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const signup = useSignUp();
  const login = useLogIn();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const pending = signup.isPending || login.isPending;
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const success = async (result: { user: { project_name: string | null } }) => {
      queryClient.clear();
      queryClient.setQueryData(getGetCurrentUserQueryKey(), result);
      await queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      await queryClient.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
      navigate(result.user.project_name ? '/dashboard' : '/onboarding');
    };
    const failure = (e: Error) => setError((e as Error & { data?: { error?: string } }).data?.error || 'ما قدرنا نكمل الطلب. تأكد من البيانات وحاول مرة ثانية.');
    if (isSignup) signup.mutate({ data: { name: name.trim(), email: email.trim(), password } }, { onSuccess: success, onError: failure });
    else login.mutate({ data: { email: email.trim(), password } }, { onSuccess: success, onError: failure });
  }
  return <div className="auth-layout">
    <aside className="auth-aside">
      <Brand />
      <div><span className="eyebrow">من الشاشة إلى قاعة المناقشة</span><blockquote style={{ marginTop: 28 }}>أنت كتبت الكود.<br /><span>حان وقت تدافع عنه.</span></blockquote><p className="muted" style={{ marginTop: 28, maxWidth: 420, lineHeight: 1.9 }}>مدرّبك الشخصي للمفاهيم اللي ممكن تكون الفارق بين إجابة محفوظة وإجابة فاهمها.</p></div>
      <span className="mono muted" style={{ fontSize: 11 }}>QODIA / PREPARE WITH PURPOSE</span>
    </aside>
    <main className="auth-main">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="eyebrow">قُوديا / {isSignup ? 'حساب جديد' : 'تسجيل الدخول'}</span><Link href="/" className="muted" style={{ fontSize: 13 }} data-testid="link-home">العودة للرئيسية</Link></div>
      <div className="auth-form">
        <span className="eyebrow">خطوتك الأولى</span>
        <h1>{isSignup ? 'ابدأ بثقة.' : 'رجعت تتدرّب؟'}</h1>
        <p>{isSignup ? 'أنشئ حسابك ونبدأ بمشروعك، مش بمادة عشوائية.' : 'مكانك جاهز. كمّل من حيث وقفت.'}</p>
        <form onSubmit={submit}>
          {isSignup && <div className="form-row"><label className="field-label" htmlFor="name">اسمك</label><input id="name" className="field" placeholder="الاسم اللي نناديك فيه" autoComplete="name" maxLength={80} required value={name} onChange={e => setName(e.target.value)} data-testid="input-name" /></div>}
          <div className="form-row"><label className="field-label" htmlFor="email">البريد الإلكتروني</label><input id="email" className="field" type="email" dir="ltr" style={{ textAlign: 'right' }} placeholder="name@example.com" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} data-testid="input-email" /></div>
          <div className="form-row"><label className="field-label" htmlFor="password">كلمة المرور</label><input id="password" className="field" type="password" dir="ltr" style={{ textAlign: 'right' }} placeholder="ثمانية أحرف على الأقل" autoComplete={isSignup ? 'new-password' : 'current-password'} minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} data-testid="input-password" /></div>
          {error && <div className="error-note" role="alert" style={{ marginBottom: 18 }} data-testid="status-auth-error">{error}</div>}
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={pending} data-testid="button-submit-auth">{pending ? 'لحظة واحدة...' : isSignup ? 'أنشئ حسابي' : 'ادخل للتدريب'} <ArrowLeft size={17} /></button>
        </form>
        <div style={{ borderTop: '1px solid #303530', marginTop: 36, paddingTop: 23, fontSize: 14, color: '#929a92' }}>{isSignup ? 'عندك حساب؟ ' : 'لسه ما عندك حساب؟ '}<Link href={isSignup ? '/login' : '/signup'} style={{ color: '#22c55e', fontWeight: 600 }} data-testid="link-switch-auth">{isSignup ? 'سجّل دخولك' : 'ابدأ مجاناً'}</Link></div>
      </div>
      <span className="muted" style={{ fontSize: 11 }}>خطوة صغيرة اليوم، إجابة أوضح يوم المناقشة.</span>
    </main>
  </div>;
}