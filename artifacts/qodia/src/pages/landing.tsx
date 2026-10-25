import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowUpLeft, BadgeCheck, Building2, Check,
  ChevronLeft, CircleHelp, Code2, GraduationCap, Layers3, Lightbulb,
  MessageCircle, ShieldCheck, Sparkles, Target, University,
} from 'lucide-react';
import { Link } from 'wouter';
import './LandingRedesign.css';

type Feedback = 'wrong' | 'correct' | null;

const toArabic = (value: number) => String(value).replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);

const touches = [
  { number: '٠١', title: 'استفزاز', icon: CircleHelp, color: 'blue', lead: 'سؤال يكشف الفجوة.', text: 'نبدأ من سؤال صغير يفتح فضولك ويحدد ما تحتاج أن تفهمه.' },
  { number: '٠٢', title: 'كشف', icon: Lightbulb, color: 'purple', lead: 'الفكرة بلا حشو.', text: 'شرح واضح بالعربية، يربط المفهوم بما تعرفه فعلًا.' },
  { number: '٠٣', title: 'استكشاف', icon: Layers3, color: 'amber', lead: 'جرّب زاوية ثانية.', text: 'تغيّر المعطيات، وتختبر إن كان فهمك يصمد خارج المثال.' },
  { number: '٠٤', title: 'بناء', icon: Code2, color: 'teal', lead: 'اكتبها بنفسك.', text: 'تطبّق الفكرة في كودك بدل الاكتفاء بنسخ إجابة جاهزة.' },
  { number: '٠٥', title: 'دفاع', icon: MessageCircle, color: 'red', lead: 'اشرح لماذا.', text: 'تتمرّن على تبرير قرارك التقني بصوتك وكلماتك.' },
];

const audiences = [
  {
    title: 'للطلاب', icon: GraduationCap, color: 'blue',
    description: 'افهم مشروعك خطوة خطوة، واستعد لشرح قراراتك التقنية بنفسك.',
    points: ['تدريب تفاعلي باللغة العربية', 'ممارسة على مفاهيم من مشروعك', 'وتيرة تعلّم تناسب وقتك'],
    href: '/session', action: 'ابدأ جلسة تدريب',
  },
  {
    title: 'للجامعات', icon: University, color: 'purple',
    description: 'مساحة لاستكشاف شكل تجربة المتابعة التعليمية، دون ادعاء بيانات جامعية حقيقية.',
    points: ['استعراض واجهة لوحة الجامعة', 'تصوّر متابعة مفاهيم التعلّم', 'نموذج أولي للنقاش والتجربة'],
    href: '/university-dashboard', action: 'استكشف نموذج الجامعة',
  },
  {
    title: 'للشركات', icon: Building2, color: 'green',
    description: 'تعرّف على تصور يساعد الفرق على التفكير في المهارات التقنية وراء السيرة الذاتية.',
    points: ['استعراض نموذج لوحة الشركة', 'تركيز على الفهم وشرح القرارات', 'لا رسوم توظيف أو نتائج مضمونة'],
    href: '/company-dashboard', action: 'استكشف نموذج الشركة',
  },
];

const examples = [
  {
    tag: 'سيناريو توضيحي ٠١', title: 'علاقة المريض بالموعد',
    body: 'في تطبيق عيادة تجريبي، قد يكون للمريض عدة مواعيد. كيف تمثّل العلاقة؟',
    detail: 'نقطة البداية: فكّر في ForeignKey، ثم اشرح لماذا يرتبط الموعد بمريض واحد.',
    code: 'Appointment → Patient',
    tone: 'blue',
  },
  {
    tag: 'سيناريو توضيحي ٠٢', title: 'قرار حذف البيانات',
    body: 'إذا حُذف سجل المريض، ما الذي ينبغي أن يحدث لمواعيده في هذا النموذج؟',
    detail: 'لا توجد إجابة واحدة لكل الأنظمة؛ وازن بين سلامة السجل وحاجة التطبيق.',
    code: 'on_delete = ؟',
    tone: 'amber',
  },
  {
    tag: 'سيناريو توضيحي ٠٣', title: 'اشرح اختيارك',
    body: 'تخيّل أن زميلك يسأل: لماذا لم تخزّن أسماء المرضى كنص داخل الموعد؟',
    detail: 'جرّب أن تشرح إعادة الاستخدام، واتساق البيانات، وما الذي يتغير عند التعديل.',
    code: 'قرار ← سبب ← أثر',
    tone: 'teal',
  },
];

const demoMetrics = [
  { value: 147, suffix: '', title: 'طالب نشط', note: 'رقم افتراضي · غير مقاس', color: 'green' },
  { value: 5, suffix: '', title: 'جامعات عربية', note: 'رقم افتراضي · غير مقاس', color: 'blue' },
  { value: 94, suffix: '٪', title: 'نجحوا في المناقشة', note: 'نسبة افتراضية · غير مقاسة', color: 'amber' },
  { value: 12, suffix: '', title: 'جاهز للتوظيف', note: 'رقم افتراضي · غير مقاس', color: 'purple' },
];

const exampleUniversities = ['جامعة دمشق', 'جامعة حلب', 'جامعة الملك سعود', 'جامعة الملك عبدالعزيز', 'الجامعة الأمريكية في الإمارات'];

function Brand({ testId }: { testId: string }) {
  return <Link className="qp-brand" href="/" aria-label="كوديا — الصفحة الرئيسية" data-testid={testId}><span className="qp-brand-mark" aria-hidden="true">k</span><span>كوديا</span></Link>;
}

function Counter({ value, suffix, start, testId }: { value: number; suffix: string; start: boolean; testId: string }) {
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCurrent(value);
      return;
    }
    let frameId = 0;
    let startTime: number | null = null;
    const duration = 850;
    const tick = (time: number) => {
      if (startTime === null) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setCurrent(Math.round(value * eased));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [start, value]);
  return <span data-testid={testId} aria-live="off">{toArabic(current)}{suffix}</span>;
}

function DemoCard() {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const answer = (correct: boolean) => setFeedback(correct ? 'correct' : 'wrong');
  return (
    <div className={`qp-demo${feedback === 'correct' ? ' is-correct' : ''}`} aria-label="سؤال تدريبي تفاعلي تجريبي">
      <div className="qp-demo-head">
        <span className="qp-live-indicator"><i aria-hidden="true" /> معاينة تفاعلية</span>
        <span className="qp-touch-label">اللمسة ٠١</span>
      </div>
      <div className="qp-demo-body">
        <div className="qp-overline">سؤال تدريبي · مثال توضيحي</div>
        <p className="qp-question">المريض بالعيادة، كم موعد ممكن يكون إلو؟</p>
        <div className="qp-answers" role="group" aria-label="اختر إجابة">
          <button type="button" onClick={() => answer(false)} className={`qp-answer${feedback === 'wrong' ? ' answer-wrong' : ''}`} aria-pressed={feedback === 'wrong'} data-testid="button-answer-one">
            <span>موعد واحد بس</span><span className="qp-answer-mark">٠١</span>
          </button>
          <button type="button" onClick={() => answer(true)} className={`qp-answer${feedback === 'correct' ? ' answer-correct' : ''}`} aria-pressed={feedback === 'correct'} data-testid="button-answer-many">
            <span>أكتر من موعد</span><span className="qp-answer-mark">{feedback === 'correct' ? <Check size={17} /> : '٠٢'}</span>
          </button>
        </div>
        <div className="qp-feedback" aria-live="polite" aria-atomic="true" data-testid="status-answer-feedback">
          {feedback === 'wrong' && <p className="feedback-wrong"><CircleHelp size={16} /> فكّر ثاني: المريض ممكن يزور العيادة مرات كثيرة.</p>}
          {feedback === 'correct' && <p className="feedback-correct"><Check size={16} /> بالضبط. هذه بداية علاقة <bdi>ForeignKey</bdi> — والآن فكّر: لماذا؟</p>}
        </div>
        <div className="qp-demo-foot">
          {feedback === 'correct'
            ? <Link href="/session" className="qp-inline-cta" data-testid="link-demo-continue">أكمل جلستك <ArrowLeft size={16} /></Link>
            : <span><Target size={15} /> جرّب الإجابة — بدون تسجيل</span>}
          <span className="qp-trial-label">تجربة مصغّرة</span>
        </div>
      </div>
      {feedback === 'correct' && <div className="qp-confetti" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} />)}</div>}
    </div>
  );
}

function Landing() {
  const [numbersVisible, setNumbersVisible] = useState(false);
  const metricsRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = metricsRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setNumbersVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setNumbersVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.18 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="qodia-proposed" lang="ar" dir="rtl">
      <header className="qp-header">
        <div className="qp-shell qp-header-inner">
          <Brand testId="link-home-header" />
          <nav className="qp-nav" aria-label="التنقل الرئيسي">
            <a href="#method" data-testid="link-method-nav">الطريقة</a>
            <a href="#audiences" data-testid="link-audiences-nav">لمن كوديا؟</a>
            <a href="#stories" data-testid="link-stories-nav">أمثلة</a>
            <Link href="/store" data-testid="link-store-nav">المتجر</Link>
          </nav>
          <div className="qp-header-actions">
            <Link className="qp-login" href="/login" data-testid="link-login-header">عندك حساب؟ ادخل <ArrowUpLeft size={15} /></Link>
            <Link className="qp-button qp-button-small" href="/session" data-testid="link-start-header">ابدأ الآن <ArrowLeft size={16} /></Link>
          </div>
        </div>
      </header>
      <main>
        <section className="qp-hero qp-shell" aria-labelledby="hero-title">
          <div className="qp-hero-copy">
            <span className="qp-origin"><span className="qp-origin-dot" /> تصميم من سوريا · للعالم العربي</span>
            <p className="qp-hero-pretitle">تدريب على الفهم، لا تسليم إجابات جاهزة</p>
            <h1 id="hero-title">لا ترسب في<br /><span>المناقشة.</span></h1>
            <p className="qp-hero-description">كوديا يساعدك تفهم مشروع تخرّجك بدل ما يحلّه عنك. تعلّم الفكرة، طبّقها، وتدرّب تشرح قراراتك التقنية بالعربي.</p>
            <div className="qp-hero-actions">
              <Link className="qp-button" href="/session" data-testid="link-start-hero">ابدأ جلستك الأولى <ArrowLeft size={18} /></Link>
              <a className="qp-button qp-button-quiet" href="#method" data-testid="link-method-hero"><span className="qp-play" aria-hidden="true">▶</span> شوف كيف نشتغل</a>
            </div>
            <Link href="/try-any-field" data-testid="link-try-any-field-hero" style={{ display: 'inline-block', marginTop: 16, color: '#a2a5a0', fontSize: 14, textDecoration: 'underline', textUnderlineOffset: 4 }}>جرّب منهجية كوديا بأي مجال</Link>
            <Link href="/store" data-testid="link-store-hero" style={{ display: 'inline-block', marginTop: 16, marginInlineStart: 20, color: '#a2a5a0', fontSize: 14, textDecoration: 'underline', textUnderlineOffset: 4 }}>استكشف المتجر</Link>
            <ul className="qp-trust-list" aria-label="مزايا تجربة كوديا">
              <li><Check size={15} /> تجربة توضيحية دون تسجيل</li>
              <li><Check size={15} /> عربي بلهجات محلية</li>
            </ul>
            <p className="qp-hero-disclaimer">هذه معاينة للمنتج — لا تعرض بيانات استخدام حقيقية.</p>
          </div>
          <div className="qp-hero-visual">
            <div className="qp-visual-index"><span>KODIA / PRACTICE</span><span>٠١ — ٠٥</span></div>
            <DemoCard />
            <div className="qp-visual-caption"><span className="qp-caption-rule" /> فهمك يبدأ بسؤال واحد</div>
          </div>
          <a className="qp-scroll-cue" href="#problem" aria-label="انتقل إلى المشكلة" data-testid="link-scroll-problem"><span>اكتشف الفكرة</span><ChevronLeft size={17} /></a>
        </section>

        <section className="qp-problem qp-section" id="problem" aria-labelledby="problem-title">
          <div className="qp-shell">
            <div className="qp-problem-layout">
              <div className="qp-problem-heading">
                <span className="qp-kicker kicker-red"><i /> الفجوة التي نريد معالجتها</span>
                <h2 id="problem-title">مشروعك مو ملفّ<br /><em>تسلّمه وتمشي.</em></h2>
              </div>
              <div className="qp-problem-copy">
                <p className="qp-big-copy">يوم المناقشة، السؤال مو بس «شو كتبت؟» — السؤال: <strong>ليش اخترت هذا الحل؟</strong></p>
                <p className="qp-muted">كثير من أدوات التعلّم تعطيك الإجابة بسرعة. كوديا مبني حول خطوة أبطأ وأهم: إنك تفهمها وتقدر تشرحها بنفسك.</p>
              </div>
            </div>
            <div className="qp-problem-ribbon" aria-label="ثلاث نقاط عن تجربة التعلم">
              <div><span className="qp-ribbon-index">A /</span><b>الإجابة الجاهزة</b><span>تخلص المهمة، ولا تكشف دائمًا الفهم.</span></div>
              <div><span className="qp-ribbon-index">B /</span><b>سؤال بلا سياق</b><span>يصعب ربطه بقرارك في المشروع.</span></div>
              <div><span className="qp-ribbon-index">C /</span><b>التدريب المقصود</b><span>يصل بين الفكرة، والكود، وسبب الاختيار.</span></div>
            </div>
            <p className="qp-honesty-note"><ShieldCheck size={15} /> لا نستند هنا إلى نسب أو دراسة منشورة؛ هذه هي المشكلة التي صُمّم المنتج لمساعدتك على التعامل معها.</p>
          </div>
        </section>

        <section className="qp-method qp-section" id="method" aria-labelledby="method-title">
          <div className="qp-shell">
            <div className="qp-section-heading">
              <span className="qp-kicker kicker-purple"><i /> طريقة التعلّم</span>
              <div className="qp-heading-row">
                <h2 id="method-title">خمس لمسات.<br /><span>فهم تقدر تدافع عنه.</span></h2>
                <p>كل لمسة تقرّبك من فهم أعمق — من أول سؤال، إلى شرح قرارك التقني.</p>
              </div>
            </div>
            <div className="qp-touch-grid">
              {touches.map(({ number, title, icon: Icon, color, lead, text }) => (
                <article className={`qp-touch-card tone-${color}`} key={number}>
                  <div className="qp-touch-top"><span className="qp-touch-number">{number} / ٠٥</span><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></div>
                  <h3>{title}</h3>
                  <p className="qp-touch-lead">{lead}</p>
                  <p className="qp-touch-description">{text}</p>
                </article>
              ))}
              <div className="qp-touch-aside">
                <span className="qp-aside-mark">q.</span>
                <p>مو حفظ الإجابة.<br /><strong>امتلاك الفكرة.</strong></p>
                <Link href="/session" data-testid="link-start-method">جرّب لمسة أولى <ArrowLeft size={16} /></Link>
              </div>
            </div>
            <div className="qp-method-bottom"><span>من الفهم</span><i /><span>إلى قرار تقدر تشرحه</span><i /><span>ثم ممارسة تبقى معك</span></div>
          </div>
        </section>

        <section className="qp-audiences qp-section" id="audiences" aria-labelledby="audiences-title">
          <div className="qp-shell">
            <div className="qp-section-heading">
              <span className="qp-kicker kicker-green"><i /> لمن كوديا؟</span>
              <div className="qp-heading-row">
                <h2 id="audiences-title">مسارات مختلفة.<br /><span>هدف تعلّم واحد.</span></h2>
                <p>ابدأ كتجربة طالب، أو استكشف النماذج المصمّمة للجامعة والفريق.</p>
              </div>
            </div>
            <div className="qp-audience-grid">
              {audiences.map(({ title, icon: Icon, color, description, points, href, action }, index) => (
                <article className={`qp-audience-card audience-${color}`} key={title}>
                  <div className="qp-audience-top"><span className="qp-audience-index">{toArabic(index + 1).padStart(2, '٠')}</span><Icon size={25} strokeWidth={1.6} aria-hidden="true" /></div>
                  <h3>{title}</h3>
                  <p className="qp-audience-description">{description}</p>
                  <ul>{points.map((point) => <li key={point}><Check size={14} /> {point}</li>)}</ul>
                  <Link href={href} className="qp-audience-link" data-testid={`link-audience-${color}`}>{action}<ArrowLeft size={16} /></Link>
                </article>
              ))}
            </div>
            <p className="qp-note-inline"><BadgeCheck size={16} /> لوحات الجامعة والشركة هنا نماذج استكشافية، وليست إشارة إلى شراكات أو بيانات حقيقية.</p>
          </div>
        </section>

        <section className="qp-numbers qp-section" ref={metricsRef} aria-labelledby="numbers-title">
          <div className="qp-shell">
            <div className="qp-numbers-heading">
              <div><span className="qp-kicker kicker-amber"><i /> سيناريو افتراضي · أرقام غير مقاسة</span><h2 id="numbers-title">كيف قد تبدو التجربة؟</h2></div>
              <p>الأرقام التالية أمثلة افتراضية فقط — <strong>ليست أعداد مستخدمين، أو نتائج مناقشات، أو بيانات فعلية.</strong></p>
            </div>
            <div className="qp-metrics">
              {demoMetrics.map((metric, index) => (
                <div className={`qp-metric metric-${metric.color}`} key={metric.title} data-testid={`status-metric-${metric.color}`}>
                  <span className="qp-metric-index">{toArabic(index + 1).padStart(2, '٠')}</span>
                  <strong className="qp-metric-value" aria-label={`${toArabic(metric.value)}${metric.suffix}`}><Counter value={metric.value} suffix={metric.suffix} start={numbersVisible} testId={`status-count-${metric.color}`} /></strong>
                  <span className="qp-metric-title">{metric.title}</span>
                  <span className="qp-metric-note"><span aria-hidden="true">↳</span> {metric.note}</span>
                </div>
              ))}
            </div>
            <div className="qp-example-universities" data-testid="status-university-examples">
              <div className="qp-university-heading"><University size={15} /> أمثلة أسماء جامعات فقط <span>لا شراكات أو ارتباطات</span></div>
              <div className="qp-university-chips">{exampleUniversities.map((name) => <span key={name}>{name}</span>)}</div>
              <p>الأسماء أمثلة نصية لتوضيح شكل الشرائح المقترحة، ولا تعني استخدامًا أو تأييدًا من أي جامعة.</p>
            </div>
            <div className="qp-sample-label" data-testid="status-fictional-metrics"><span /> سيناريو افتراضي — الأرقام غير مقاسة ولا تمثل بيانات مباشرة</div>
          </div>
        </section>

        <section className="qp-stories qp-section" id="stories" aria-labelledby="stories-title">
          <div className="qp-shell">
            <div className="qp-section-heading">
              <span className="qp-kicker kicker-blue"><i /> أمثلة من جلسة ممكنة</span>
              <div className="qp-heading-row">
                <h2 id="stories-title">تعلّم على مواقف<br /><span>قريبة من كودك.</span></h2>
                <p>ثلاثة سيناريوهات تدريب مصطنعة لتوضيح طريقة التفكير — ليست قصص مستخدمين أو مشاريع موثقة.</p>
              </div>
            </div>
            <div className="qp-story-grid">
              {examples.map((example, index) => (
                <article className={`qp-story-card story-${example.tone}`} key={example.tag}>
                  <div className="qp-story-meta"><span>{example.tag}</span><span>{toArabic(index + 1).padStart(2, '٠')}</span></div>
                  <h3>{example.title}</h3>
                  <p>{example.body}</p>
                  <div className="qp-story-code" dir="ltr"><Code2 size={15} /> <bdi>{example.code}</bdi></div>
                  <div className="qp-story-reveal"><span>فكّر في</span><p>{example.detail}</p></div>
                </article>
              ))}
            </div>
            <div className="qp-story-foot"><Sparkles size={16} /> الهدف مو إنك تعرف السطر فقط — بل تقدر تشرح السبب وراءه.</div>
          </div>
        </section>

        <section className="qp-final qp-section" aria-labelledby="final-title">
          <div className="qp-shell">
            <div className="qp-final-panel">
              <div className="qp-final-orbit" aria-hidden="true"><span>k</span></div>
              <div className="qp-final-copy">
                <span className="qp-kicker kicker-green"><i /> ابدأ بفكرة واحدة</span>
                <h2 id="final-title">خلّي المناقشة<br /><em>خطوة تدربت عليها.</em></h2>
                <p>ابدأ بجلسة تدريب قصيرة. اسأل، جرّب، وفسّر اختيارك — من غير وعود بنتيجة مضمونة.</p>
                <div className="qp-final-actions">
                  <Link href="/session" className="qp-button" data-testid="link-start-final">ابدأ جلستك <ArrowLeft size={18} /></Link>
                  <Link href="/login" className="qp-final-login" data-testid="link-login-final">عندك حساب؟ ادخل من هنا <ArrowUpLeft size={15} /></Link>
                </div>
              </div>
              <div className="qp-final-side"><span>ابدأ هنا</span><div>سؤال<br />واحد.</div><ArrowLeft size={18} /></div>
            </div>
          </div>
        </section>
      </main>
      <footer className="qp-footer">
        <div className="qp-shell">
          <div className="qp-footer-main">
            <div className="qp-footer-brand"><Brand testId="link-home-footer" /><p>تعلّم مشروعك. دافع عن اختياراتك.</p></div>
            <nav className="qp-footer-links" aria-label="روابط كوديا">
              <Link href="/session" data-testid="link-footer-students">للطلاب</Link><Link href="/university-dashboard" data-testid="link-footer-universities">للجامعات</Link><Link href="/company-dashboard" data-testid="link-footer-companies">للشركات</Link><a href="#method" data-testid="link-footer-method">طريقة الخمس لمسات</a>
            </nav>
            <div className="qp-footer-origin"><span>سوريا → العالم العربي</span><span>تعليم تقني يبدأ من الفهم</span></div>
          </div>
          <div className="qp-footer-bottom"><span>© {toArabic(new Date().getFullYear())} كوديا</span><span>واجهة توضيحية · الأرقام والسيناريوهات المعروضة أمثلة فقط</span><a href="#hero-title" data-testid="link-back-to-top">للأعلى ↑</a></div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;