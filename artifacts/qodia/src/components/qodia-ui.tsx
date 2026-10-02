import { type ReactNode } from 'react';
import { ArrowLeft, LogOut, RotateCcw } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetCurrentUserQueryKey, getGetDashboardQueryKey, getGetSessionsQueryKey, useLogOut } from '@workspace/api-client-react';

export function Brand() {
  return <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark" aria-hidden="true">k</span><span>كوديا</span></Link>;
}

export function LoadingState({ label = 'نجهّز مساحتك...' }: { label?: string }) {
  return <div className="shell" style={{ paddingBlock: 80 }} role="status" data-testid="status-loading">
    <div className="skeleton" style={{ width: 140, height: 12, marginBottom: 28 }} />
    <div className="skeleton" style={{ width: 'min(400px, 80%)', height: 45, marginBottom: 30 }} />
    <div className="skeleton" style={{ width: '100%', height: 180 }} />
    <p className="muted" style={{ marginTop: 24 }}>{label}</p>
  </div>;
}

export function ErrorState({ retry, text = 'تعذّر تحميل المحتوى. تأكد من اتصالك وحاول مرة ثانية.' }: { retry: () => void; text?: string }) {
  return <div className="shell" style={{ paddingBlock: 85 }} role="alert" data-testid="status-error">
    <div className="panel" style={{ maxWidth: 550, padding: 32 }}>
      <span className="eyebrow">توقف مؤقت</span>
      <h2 style={{ fontSize: 28, margin: '18px 0 8px' }}>ما مشيت من أول مرة.</h2>
      <p className="muted">{text}</p>
      <button className="btn btn-outline" onClick={retry} data-testid="button-retry"><RotateCcw size={16} /> حاول مجدداً</button>
    </div>
  </div>;
}

export function AppHeader({ active }: { active?: 'dashboard' | 'session' }) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const logout = useLogOut();
  return <header className="shell app-header">
    <Brand />
    <nav className="app-nav" aria-label="التنقل الرئيسي">
      <Link href="/dashboard" className={active === 'dashboard' ? 'current' : ''} data-testid="link-dashboard">لوحتي</Link>
      <Link href="/session" className={active === 'session' ? 'current' : ''} data-testid="link-session">التدريب</Link>
      <Link href="/final-defense" data-testid="link-nav-final-defense">المناقشة</Link>
      {active === 'dashboard' && <Link href="/university-dashboard" data-testid="link-university-dashboard">لوحة الجامعة</Link>}
      {active === 'dashboard' && <Link href="/company-dashboard" data-testid="link-company-dashboard">لوحة الشركات</Link>}
      <button className="btn btn-quiet" style={{ minHeight: 38, padding: '7px 9px' }} disabled={logout.isPending} onClick={() => logout.mutate(undefined, { onSuccess: async () => {
        await queryClient.cancelQueries();
        queryClient.removeQueries({ queryKey: getGetCurrentUserQueryKey() });
        queryClient.removeQueries({ queryKey: getGetDashboardQueryKey() });
        queryClient.removeQueries({ queryKey: getGetSessionsQueryKey() });
        navigate('/login');
      } })} data-testid="button-logout" aria-label="تسجيل الخروج"><LogOut size={17} /><span className="hide-mobile">خروج</span></button>
    </nav>
  </header>;
}

export function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="btn btn-primary" data-testid={`link-action-${href.replace(/\W/g, '')}`}>{children}<ArrowLeft size={17} /></Link>;
}