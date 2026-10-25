import { type ReactNode } from 'react';
import { ArrowUpLeft } from 'lucide-react';
import { Link } from 'wouter';
import { toArabicDigits } from './store-utils';
import '../../pages/LandingRedesign.css';
import '../../pages/store.css';

function Brand({ testId }: { testId: string }) {
  return <Link className="qp-brand" href="/" aria-label="كوديا — الصفحة الرئيسية" data-testid={testId}><span className="qp-brand-mark" aria-hidden="true">k</span><span>كوديا</span></Link>;
}

export function StoreLayout({ children, current = 'store' }: { children: ReactNode; current?: 'store' | 'admin' }) {
  return (
    <div className="qodia-proposed st-root" lang="ar" dir="rtl">
      <header className="qp-header">
        <div className="qp-shell qp-header-inner">
          <Brand testId="link-home-header" />
          <nav className="qp-nav st-nav" aria-label="التنقل الرئيسي">
            <Link href="/" data-testid="link-home-nav">الرئيسية</Link>
            <a href="/#method" data-testid="link-method-nav">الطريقة</a>
            <Link href="/store" aria-current={current === 'store' ? 'page' : undefined} className={current === 'store' ? 'st-nav-current' : ''} data-testid="link-store-nav">المتجر</Link>
          </nav>
          <div className="qp-header-actions">
            <Link className="qp-login st-login" href="/login" data-testid="link-login-header">دخول <ArrowUpLeft size={15} /></Link>
          </div>
        </div>
      </header>
      <main id="store-main">{children}</main>
      <footer className="qp-footer">
        <div className="qp-shell">
          <div className="qp-footer-main">
            <div className="qp-footer-brand"><Brand testId="link-home-footer" /><p>لا كود بلا شرح. افهم كل ملف، ودافع عن كل قرار.</p></div>
            <nav className="qp-footer-links" aria-label="روابط كوديا">
              <Link href="/" data-testid="link-footer-home">الرئيسية</Link>
              <a href="/#method" data-testid="link-footer-method">طريقة الخمس لمسات</a>
              <Link href="/store" data-testid="link-footer-store">المتجر</Link>
              <Link href="/login" data-testid="link-footer-login">دخول</Link>
            </nav>
            <div className="qp-footer-origin"><span>المتجر · المرحلة الأولى</span><span>كتالوج وتسجيل اهتمام فقط</span></div>
          </div>
          <div className="qp-footer-bottom">
            <span>© {toArabicDigits(new Date().getFullYear())} كوديا</span>
            <span>لا يوجد بيع أو دفع أو تنزيل حاليًا · لا تقييمات ولا أرقام مبيعات</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
