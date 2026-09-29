import { ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { Brand } from '@/components/qodia-ui';

export default function NotFound() {
  return <div className="min-h-[100dvh] shell" style={{ display: 'flex', flexDirection: 'column' }}>
    <header className="site-header"><Brand /></header>
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'start', justifyContent: 'center', paddingBlock: 80 }}>
      <span className="mono" style={{ color: '#22c55e', fontSize: 17 }}>404 / NOT FOUND</span>
      <h1 className="section-title" style={{ margin: '22px 0 10px' }}>هالصفحة مش من أسئلة المناقشة.</h1>
      <p className="muted" style={{ fontSize: 17, lineHeight: 1.8 }}>الرابط اللي طلبته مش موجود. خلّينا نرجع للمكان الصح.</p>
      <Link href="/" className="btn btn-primary" style={{ marginTop: 20 }} data-testid="link-return-home"><ArrowRight size={17} /> الرجوع للرئيسية</Link>
    </main>
  </div>;
}