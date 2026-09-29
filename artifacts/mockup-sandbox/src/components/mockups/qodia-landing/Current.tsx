import { ArrowLeft, ArrowUpLeft, Check, MoveUpLeft } from 'lucide-react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import './_group.css';

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

function Link({ href, ...props }: LinkProps) {
  return <a href={href} {...props} />;
}

function Brand() {
  return <Link href="/" className="brand" data-testid="link-brand"><span className="brand-mark" aria-hidden="true">q</span><span>قُوديا</span></Link>;
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="btn btn-primary" data-testid={`link-action-${href.replace(/\W/g, '')}`}>{children}<ArrowLeft size={17} /></Link>;
}

const steps = [
  ['استفزاز', 'سؤال بسيط يفضح الفجوة في فهمك.'],
  ['كشف', 'الفكرة من الداخل، بدون حشو محاضرات.'],
  ['استكشاف', 'تختبر القرار في سيناريو مختلف.'],
  ['بناء', 'تكتب السطر بإيدك، لا نسخ ولصق.'],
  ['دفاع', 'تجاوب كأن الدكتور قدامك.'],
];

export function Current() {
  return <div className="qodia-current min-h-[100dvh]" lang="ar" dir="rtl">
    <header className="shell site-header"><Brand /><nav className="site-nav"><Link href="/login" className="nav-secondary" data-testid="link-login">عندك حساب؟ ادخل <ArrowUpLeft size={14} style={{ display: 'inline-block' }} /></Link><Link href="/signup" className="btn btn-outline" style={{ minHeight: 40, padding: '8px 16px' }} data-testid="link-signup">ابدأ مجاناً <ArrowLeft size={15} /></Link></nav></header>
    <main>
      <section className="shell hero">
        <div>
          <span className="eyebrow">تدريب المناقشة، مش حفظ الإجابات.</span>
          <h1>لا ترسب في<br /><em>المناقشة.</em></h1>
          <p>مشروعك تعبك. لا تخلي سؤال واحد عن سطر كتبته يضيع تعب سنة. قُوديا يدرّبك تفهم، تكتب، وتدافع عن قراراتك التقنية.</p>
          <div className="hero-actions"><ActionLink href="/signup">ابدأ مجاناً</ActionLink><Link href="#method" className="btn btn-outline" data-testid="link-method">شوف كيف نشتغل <MoveUpLeft size={16} /></Link></div>
          <div className="hero-note"><i /> خمس خطوات. فكرة واحدة. ثقة أكبر كل يوم.</div>
        </div>
        <div className="preview" aria-label="معاينة سؤال تدريبي">
          <div className="preview-top"><span className="mono">QODIA / PRACTICE 01</span><span className="preview-dot" /></div>
          <p className="eyebrow" style={{ marginTop: 35, color: '#75a9ec' }}>اللمسة الأولى — استفزاز</p>
          <div className="preview-question">المريض الواحد بالعيادة، كم موعد ممكن يكون إلو؟</div>
          <div className="preview-choice">موعد واحد بس <span className="mono">01</span></div>
          <div className="preview-choice active">أكتر من موعد <Check size={18} /></div>
          <div style={{ display: 'flex', gap: 5, marginTop: 36 }}>{Array.from({ length: 5 }, (_, i) => <div key={i} style={{ height: 3, flex: 1, background: i === 0 ? '#22c55e' : '#303930' }} />)}</div>
        </div>
      </section>
      <section id="method" className="section-divider" style={{ paddingBlock: 100 }}>
        <div className="shell">
          <span className="section-kicker">01 / الطريقة</span>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 25, flexWrap: 'wrap' }}>
            <h2 className="section-title" style={{ maxWidth: 650, margin: '16px 0 42px' }}>مو كفاية تقول «بعرفها».<br /><span style={{ color: '#858d85' }}>لازم تثبتها.</span></h2>
            <p className="muted" style={{ maxWidth: 300, lineHeight: 1.9, marginBottom: 47 }}>عشان هيك كل مفهوم بيمر بخمس لمسات، من أول سؤال لآخر دفاع.</p>
          </div>
          <div className="steps-grid">{steps.map(([title, desc], i) => <div className="step-cell" key={title}><span className="num">0{i + 1} / 05</span><h3>{title}</h3><p>{desc}</p></div>)}</div>
        </div>
      </section>
      <section className="shell statement section-divider">
        <div><span className="section-kicker">02 / التدريب الحقيقي</span><div className="quote" style={{ marginTop: 29 }}>الدكتور مش رح يسألك شو نسخت من الإنترنت. رح يسألك <span style={{ color: '#22c55e' }}>ليش اخترته.</span></div><p className="muted" style={{ lineHeight: 1.9, marginTop: 24 }}>من علاقة في قاعدة البيانات إلى قرار في الكود: نحول المعرفة إلى إجابة تقدر تقولها بصوت واثق.</p></div>
        <div className="mini-terminal"><div style={{ color: '#7d887e', borderBottom: '1px solid #303b30', paddingBottom: 12, marginBottom: 15 }}>models.py / clinic</div><div><strong>class</strong> Appointment(models.Model):</div><div>&nbsp;&nbsp;patient = models.ForeignKey(</div><div>&nbsp;&nbsp;&nbsp;&nbsp;Patient,</div><div>&nbsp;&nbsp;&nbsp;&nbsp;on_delete=models.<strong>CASCADE</strong></div><div>&nbsp;&nbsp;)</div><div style={{ marginTop: 20, color: '#79877b' }}># Why CASCADE? Can you defend this choice?</div><div style={{ color: '#22c55e' }}>→ Your answer starts here.</div></div>
      </section>
      <section className="section-divider" style={{ paddingBlock: 100 }}><div className="shell" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 36 }}><div><span className="section-kicker">03 / إيقاعك</span><h2 style={{ fontSize: 30, letterSpacing: '-.04em' }}>جلسة واحدة اليوم.<br />فرق كبير يوم المناقشة.</h2></div><div className="muted" style={{ lineHeight: 2 }}>تشوف تقدّمك، تحافظ على سلسلة تدريبك، وتجمع نقاط خبرة على كل خطوة تفهمها صح. ما في ضغط مواعيد؛ في ممارسة واضحة ترجع لها كل يوم.</div><div className="panel" style={{ padding: 25, borderColor: '#345438' }}><span className="eyebrow">الدرس الأول</span><h3 style={{ fontSize: 24, margin: '15px 0 8px' }}>Django ForeignKey</h3><p className="muted" style={{ lineHeight: 1.8 }}>من علاقة المريض بموعده، إلى الدفاع عن on_delete.</p></div></div></section>
      <section className="shell" style={{ paddingBottom: 85 }}><div className="cta-block"><span className="eyebrow">جاهز تبدأ؟</span><h2 className="section-title" style={{ margin: '18px auto 10px', maxWidth: 600 }}>يوم المناقشة مش مفاجأة.<br />خلّيه نتيجة تدريب.</h2><p className="muted" style={{ marginBottom: 28 }}>ابدأ بمفهوم واحد. دافع عنه كأنه مشروعك كله.</p><ActionLink href="/signup">ابدأ مجاناً</ActionLink></div></section>
    </main>
    <footer className="shell footer section-divider"><span>قُوديا — تعلّم لتدافع عن شغلك.</span><span className="mono">QODIA © {new Date().getFullYear()}</span></footer>
  </div>;
}