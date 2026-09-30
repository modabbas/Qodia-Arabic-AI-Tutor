import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Bookmark, BriefcaseBusiness, Check, Info, Play, RotateCcw, Search, X } from 'lucide-react';
import styles from './CompanyDashboard.module.css';

type Skill = { name: string; color: 'blue' | 'amber' | 'purple' | 'teal' | 'red' | 'green' };
type Candidate = {
  id: string; name: string; initial: string; avatar: Skill['color']; flag: string;
  country: string; location: string; status: string; match: number; readiness: number;
  skills: Skill[]; bio: string; sessions: number; projects: number; feminine: boolean;
};
type InfoDialog = { title: string; description: string } | null;
type ChartInstance = { destroy: () => void };
type ChartConstructor = new (element: HTMLCanvasElement, configuration: unknown) => ChartInstance;

declare global { interface Window { Chart?: ChartConstructor } }

const digits = (value: number | string) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
const number = (value: number) => new Intl.NumberFormat('ar-EG').format(value);
const colors: Record<Skill['color'], { foreground: string; background: string }> = {
  blue: { foreground: '#7cc7ff', background: '#1b3140' },
  amber: { foreground: '#f5b84a', background: '#382b17' },
  purple: { foreground: '#c792ea', background: '#33253d' },
  teal: { foreground: '#4ec9b0', background: '#18352f' },
  red: { foreground: '#f2545b', background: '#3a2225' },
  green: { foreground: '#22c55e', background: '#193322' },
};
const candidates: Candidate[] = [
  { id: 'lina', name: 'لينا الأحمد', initial: 'ل', avatar: 'purple', flag: '🇸🇾', country: 'سوريا', location: 'جامعة دمشق', status: 'حديثة التخرج', match: 94, readiness: 92, feminine: true, sessions: 32, projects: 5,
    skills: [{ name: 'Django', color: 'blue' }, { name: 'PostgreSQL', color: 'amber' }, { name: 'Redis', color: 'teal' }],
    bio: 'طالبة سنة أخيرة، متخصصة في تطوير backend مع Django. أكملت مشروع نظام حجز عيادات كامل مع authentication و payment.' },
  { id: 'ahmed', name: 'أحمد ياسين', initial: 'أ', avatar: 'teal', flag: '🇸🇦', country: 'السعودية', location: 'الملك سعود', status: 'طالب سنة أخيرة', match: 89, readiness: 87, feminine: false, sessions: 35, projects: 4,
    skills: [{ name: 'Node.js', color: 'amber' }, { name: 'React', color: 'purple' }, { name: 'MongoDB', color: 'blue' }],
    bio: 'مطوّر تطبيقات ويب يربط واجهات React بخدمات Node.js. بنى نظام متابعة مشاريع يستخدم MongoDB ويهتم بتجربة المستخدم وأداء الواجهات.' },
  { id: 'mohammad', name: 'محمد الشامي', initial: 'م', avatar: 'blue', flag: '🇸🇾', country: 'سوريا', location: 'جامعة حلب', status: 'حديث التخرج', match: 85, readiness: 83, feminine: false, sessions: 31, projects: 4,
    skills: [{ name: 'React', color: 'purple' }, { name: 'Next.js', color: 'purple' }, { name: 'Tailwind', color: 'teal' }],
    bio: 'مطوّر واجهات يركّز على React وNext.js. أنجز واجهة متجر قابلة للتجاوب وشرح اختياراته التقنية خلال جلسات المناقشة.' },
  { id: 'khaled', name: 'خالد الحسن', initial: 'خ', avatar: 'amber', flag: '🇦🇪', country: 'الإمارات', location: 'الجامعة الأمريكية', status: 'طالب سنة أخيرة', match: 78, readiness: 75, feminine: false, sessions: 30, projects: 3,
    skills: [{ name: 'Flutter', color: 'teal' }, { name: 'Firebase', color: 'amber' }, { name: 'Dart', color: 'blue' }],
    bio: 'مطوّر تطبيقات هاتف باستخدام Flutter وDart. صمّم تطبيقاً لتنظيم الفعاليات مع مزامنة البيانات عبر Firebase.' },
  { id: 'maryam', name: 'مريم العلي', initial: 'م', avatar: 'red', flag: '🇸🇦', country: 'السعودية', location: 'الملك عبدالعزيز', status: 'حديثة التخرج', match: 91, readiness: 88, feminine: true, sessions: 34, projects: 5,
    skills: [{ name: 'Django', color: 'blue' }, { name: 'DRF', color: 'blue' }, { name: 'PostgreSQL', color: 'amber' }],
    bio: 'مطوّرة خدمات خلفية باستخدام Django وDRF. أنجزت واجهات API لمنصة تعليمية مع تصميم قواعد بيانات PostgreSQL.' },
  { id: 'omar', name: 'عمر خالد', initial: 'ع', avatar: 'green', flag: '🇯🇴', country: 'الأردن', location: 'الأردنية', status: 'طالب سنة أخيرة', match: 82, readiness: 79, feminine: false, sessions: 33, projects: 3,
    skills: [{ name: 'Laravel', color: 'red' }, { name: 'MySQL', color: 'amber' }, { name: 'Vue.js', color: 'teal' }],
    bio: 'مطوّر ويب يعمل على Laravel وVue.js. بنى لوحة لإدارة حجوزات المواعيد مع قاعدة بيانات MySQL.' },
];
const technologies = [
  { name: 'Django', count: 42, percent: 28, color: 'blue' },
  { name: 'Node.js + Express', count: 35, percent: 24, color: 'amber' },
  { name: 'React + Next.js', count: 28, percent: 19, color: 'purple' },
  { name: 'Flutter', count: 22, percent: 15, color: 'teal' },
  { name: 'Laravel', count: 20, percent: 14, color: 'red' },
] as const;
const countries = [
  { flag: '🇸🇦', name: 'السعودية', schools: 'جامعة الملك سعود · جامعة الملك عبدالعزيز', count: 58, percent: 40 },
  { flag: '🇸🇾', name: 'سوريا', schools: 'جامعة دمشق · جامعة حلب', count: 41, percent: 28 },
  { flag: '🇦🇪', name: 'الإمارات', schools: 'الجامعة الأمريكية · خليفة', count: 23, percent: 16 },
  { flag: '🇪🇬', name: 'مصر', schools: 'القاهرة · عين شمس', count: 15, percent: 10 },
  { flag: '🇯🇴', name: 'الأردن', schools: 'الأردنية · اليرموك', count: 10, percent: 7 },
];
const growth = [47, 52, 58, 61, 65, 72, 78, 82, 85, 89, 94, 98, 103, 107, 112, 115, 119, 123, 127, 131, 134, 138, 141, 143, 145, 146, 147, 147, 147, 147];
const notificationPool = [
  'طالب جديد انضم من جامعة الملك سعود 🎓',
  'أحمد ياسين رفع مستواه للـ ٩٠٪ 📈',
  'شركة تقنية سعودية دخلت للتو 🏢',
  'لينا الأحمد اجتازت اختبار المناقشة ✓',
  '٣ مرشحون جدد جاهزون للتوظيف 🚀',
  'طالب من الأردن أكمل ٥ جلسات اليوم 🔥',
  'شركة نون طلبت مقابلة مع محمد الشامي 📞',
];
const STORAGE_SEARCH = 'qodia-talent-bridge-saved-search';
const STORAGE_SAVED = 'qodia-talent-bridge-saved-candidates';
let chartScriptPromise: Promise<ChartConstructor> | null = null;

function loadChart(): Promise<ChartConstructor> {
  if (window.Chart) return Promise.resolve(window.Chart);
  if (chartScriptPromise) return chartScriptPromise;
  chartScriptPromise = new Promise<ChartConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.async = true;
    script.dataset.qodiaChart = 'true';
    script.onload = () => window.Chart ? resolve(window.Chart) : reject(new Error('Chart.js unavailable'));
    script.onerror = () => { script.remove(); reject(new Error('Chart.js failed to load')); };
    document.head.appendChild(script);
  }).catch(error => { chartScriptPromise = null; throw error; });
  return chartScriptPromise;
}

function GrowthChart() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    let chart: ChartInstance | undefined;
    setStatus('loading');
    loadChart().then(Chart => {
      if (!active || !canvas.current) return;
      try {
        const context = canvas.current.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        const gradient = context.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(34,197,94,0.17)');
        gradient.addColorStop(1, 'rgba(34,197,94,0.015)');
        chart = new Chart(canvas.current, {
          type: 'line',
          data: {
            labels: growth.map((_, index) => index - 29),
            datasets: [{ data: growth, borderColor: '#22c55e', backgroundColor: gradient, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#22c55e', fill: true, tension: 0.4 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, animation: { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 900 },
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                rtl: true, titleAlign: 'right', bodyAlign: 'right', displayColors: false,
                backgroundColor: '#1b1b1b', borderColor: '#3d3d3d', borderWidth: 1, padding: 12,
                callbacks: {
                  title: (items: { dataIndex: number }[]) => `اليوم ${items[0]?.dataIndex === 29 ? '٠' : `-${number(29 - (items[0]?.dataIndex ?? 29))}`}`,
                  label: (item: { parsed: { y: number } }) => `${number(item.parsed.y)} طالب`,
                },
              },
            },
            scales: {
              x: { grid: { display: false }, border: { display: false }, ticks: { color: '#777', maxTicksLimit: 7, callback: (_: unknown, index: number) => index === 29 ? 'اليوم' : `-${number(29 - index)}` } },
              y: { min: 40, max: 160, border: { display: false, dash: [3, 4] }, grid: { color: 'rgba(255,255,255,0.065)' }, ticks: { stepSize: 30, color: '#777', callback: (value: number) => number(value) } },
            },
          },
        });
        setStatus('ready');
      } catch { setStatus('error'); }
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; chart?.destroy(); };
  }, [attempt]);
  return <div className={styles.chartBox} data-testid="chart-growth">
    <canvas ref={canvas} role="img" aria-label="نمو عدد المرشحين خلال آخر ٣٠ يوم من ٤٧ إلى ١٤٧" style={{ visibility: status === 'ready' ? 'visible' : 'hidden' }} />
    {status === 'loading' && <div className={styles.chartState} data-testid="status-chart-loading"><div className={styles.chartSkeleton} aria-label="جارٍ تحميل الرسم البياني" /></div>}
    {status === 'error' && <div className={styles.chartState} data-testid="status-chart-unavailable"><p>الرسم البياني غير متاح حالياً. بيانات النمو التجريبية: من ٤٧ إلى ١٤٧ مرشحاً.</p><button className={styles.button} onClick={() => setAttempt(value => value + 1)} data-testid="button-retry-chart">إعادة المحاولة</button></div>}
  </div>;
}

function SkillTag({ skill }: { skill: Skill }) {
  return <span className={styles.skill} style={{ '--skill-color': colors[skill.color].foreground, '--skill-bg': colors[skill.color].background } as CSSProperties}>{skill.name}</span>;
}

export default function CompanyDashboard() {
  // TODO: Restrict this demo to company accounts when company authentication and hiring APIs exist.
  const [search, setSearch] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_SEARCH) || '{}').search || ''; } catch { return ''; } });
  const [tech, setTech] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_SEARCH) || '{}').tech || ''; } catch { return ''; } });
  const [country, setCountry] = useState(() => { try { return JSON.parse(localStorage.getItem(STORAGE_SEARCH) || '{}').country || ''; } catch { return ''; } });
  const [savedIds, setSavedIds] = useState<string[]>(() => { try { const ids = JSON.parse(localStorage.getItem(STORAGE_SAVED) || '[]'); return Array.isArray(ids) ? ids : []; } catch { return []; } });
  const [feedback, setFeedback] = useState('');
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [info, setInfo] = useState<InfoDialog>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
  const [readyCount, setReadyCount] = useState(0);
  const [countProgress, setCountProgress] = useState(0);
  const [delta, setDelta] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toastId = useRef(0);
  const nextNotification = useRef(-1);
  const modalOpen = !!selected || !!info;

  const filtered = useMemo(() => candidates.filter(candidate =>
    (!search || `${candidate.name} ${candidate.location} ${candidate.country} ${candidate.skills.map(skill => skill.name).join(' ')}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) &&
    (!tech || candidate.skills.some(skill => skill.name === tech || (tech === 'Node.js' && skill.name === 'Node.js'))) &&
    (!country || candidate.country === country)
  ), [search, tech, country]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setCountProgress(1); setReadyCount(147); return; }
    const start = performance.now();
    let frame = 0;
    const animate = (now: number) => {
      const fraction = Math.min((now - start) / 1500, 1);
      const eased = 1 - Math.pow(1 - fraction, 3);
      setCountProgress(eased);
      setReadyCount(Math.round(147 * eased));
      if (fraction < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let step = 0;
    let clearDelta: ReturnType<typeof setTimeout>;
    const interval = setInterval(() => {
      if (step >= 2) return;
      const values = [147, 149, 152];
      const change = values[step + 1] - values[step];
      step++;
      setReadyCount(values[step]);
      setDelta(change);
      setFlashKey(value => value + 1);
      clearTimeout(clearDelta);
      clearDelta = setTimeout(() => setDelta(0), 1000);
    }, 30_000);
    return () => { clearInterval(interval); clearTimeout(clearDelta); };
  }, []);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let active = true;
    const schedule = () => {
      timeout = setTimeout(() => {
        if (!active) return;
        let index = Math.floor(Math.random() * notificationPool.length);
        if (index === nextNotification.current) index = (index + 1) % notificationPool.length;
        nextNotification.current = index;
        const id = ++toastId.current;
        setToasts(current => [...current, { id, message: notificationPool[index] }].slice(-3));
        toastTimers.current.push(setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 5000));
        schedule();
      }, 8000 + Math.random() * 7000);
    };
    schedule();
    return () => { active = false; clearTimeout(timeout); toastTimers.current.forEach(clearTimeout); toastTimers.current = []; };
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') { setSelected(null); setInfo(null); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', onKeyDown); returnFocus.current?.focus(); };
  }, [modalOpen]);

  useEffect(() => {
    if (modalOpen) dialogRef.current?.focus();
  }, [selected, info, modalOpen]);

  const openCandidate = (candidate: Candidate) => { returnFocus.current = document.activeElement as HTMLElement; setInfo(null); setSelected(candidate); };
  const openInfo = (title: string, description: string) => { returnFocus.current = document.activeElement as HTMLElement; setSelected(null); setInfo({ title, description }); };
  const closeDialog = () => { setSelected(null); setInfo(null); };
  const onCardKey = (event: KeyboardEvent<HTMLElement>, candidate: Candidate) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCandidate(candidate); }
  };
  const saveSearch = () => {
    try {
      localStorage.setItem(STORAGE_SEARCH, JSON.stringify({ search, tech, country }));
      setFeedback('تم حفظ فلاتر البحث على هذا الجهاز. ستُستعاد عند العودة.');
    } catch { setFeedback('تعذّر حفظ البحث على هذا الجهاز. تحقّق من إعدادات التخزين.'); }
  };
  const toggleSaved = (id: string) => {
    const next = savedIds.includes(id) ? savedIds.filter(value => value !== id) : [...savedIds, id];
    try { localStorage.setItem(STORAGE_SAVED, JSON.stringify(next)); setSavedIds(next); setFeedback(next.includes(id) ? 'حُفظ المرشح على هذا الجهاز فقط.' : 'أُزيل المرشح من المحفوظات المحلية.'); }
    catch { setFeedback('تعذّر حفظ المرشح على هذا الجهاز.'); }
  };
  const reset = () => { setSearch(''); setTech(''); setCountry(''); setFeedback('تمت إعادة تعيين الفلاتر الحالية. البحث المحفوظ لا يتغيّر حتى تحفظ بحثاً جديداً.'); };
  const interview = (candidate: Candidate) => openInfo('طلب مقابلة · عرض تجريبي', `هذه تجربة توضيحية لطلب مقابلة مع ${candidate.name}. لم يُرسَل أي طلب فعلي ولم يتم التواصل مع المرشح.`);
  const video = () => openInfo('فيديو الدفاع قريباً', 'ميزة فيديو الدفاع قيد الإعداد. لا يوجد فيديو متاح للمشاهدة في هذه النسخة التجريبية.');

  return <main className={styles.page} dir="rtl">
    <div className={styles.wrap}>
      <header className={styles.masthead}>
        <div className={styles.identity}>
          <p className={styles.eyebrow}>KODIA / TALENT BRIDGE</p>
          <h1>شركة نون · لوحة التوظيف الذكية</h1>
          <p className={styles.subtitle}><span className={styles.liveDot} aria-hidden="true" /><span>Live Data · Talent Bridge · مطوّرون موثّقون</span><span className={styles.demoLabel} data-testid="label-simulated-data">بيانات تجريبية · نشاط محاكى</span></p>
        </div>
        <div className={styles.actions}>
          <button className={styles.button} type="button" onClick={saveSearch} data-testid="button-save-search"><Bookmark size={15} /> حفظ البحث</button>
          <button className={`${styles.button} ${styles.primary}`} type="button" onClick={() => openInfo('نشر وظيفة جديدة · عرض تجريبي', 'يمكنك استكشاف هذه الواجهة التجريبية، لكن نشر الوظائف غير متاح بعد. لم تُنشَر أي وظيفة.')} data-testid="button-publish-job"><BriefcaseBusiness size={15} /> نشر وظيفة جديدة</button>
        </div>
      </header>
      {feedback && <p className={styles.actionStatus} role="status" data-testid="status-local-action">{feedback}</p>}

      <section className={styles.stats} aria-label="مؤشرات المنصة التجريبية">
        <div className={`${styles.card} ${styles.stat}`}><span className={styles.statLabel}>مرشحون جاهزون</span><div className={styles.statNumberWrap}><strong key={flashKey} className={`${styles.statNumber} ${flashKey ? styles.flash : ''}`} data-testid="value-ready-candidates">{number(readyCount)}</strong>{delta > 0 && <span key={`delta-${flashKey}`} className={styles.floatDelta} aria-hidden="true">+{number(delta)}</span>}</div><span className={styles.statNote}>↑ {digits(23)} هذا الأسبوع</span></div>
        <div className={`${styles.card} ${styles.stat}`}><span className={styles.statLabel}>تطابقون لوظائفك</span><strong className={styles.statNumber} style={{ marginTop: 14, color: 'var(--green)' }} data-testid="value-matched-candidates">{number(Math.round(32 * countProgress))}</strong><span className={styles.statNote}>مبني على متطلباتك</span></div>
        <div className={`${styles.card} ${styles.stat}`}><span className={styles.statLabel}>وقت التوظيف</span><strong className={styles.statNumber} style={{ marginTop: 14 }} data-testid="value-hiring-time">{number(Math.round(12 * countProgress))} يوم</strong><span className={styles.statNote}>↑ أسرع بـ {number(60)}٪ من LinkedIn</span></div>
        <div className={`${styles.card} ${styles.stat}`}><span className={styles.statLabel}>التكلفة لكل توظيف</span><strong className={styles.statNumber} style={{ marginTop: 14 }} data-testid="value-hiring-cost"><span dir="ltr">${number(Math.round(500 * countProgress))}</span></strong><span className={styles.statNote}>↑ مقابل <span dir="ltr">${number(5000)}</span> للوكالات</span></div>
      </section>

      <section className={`${styles.card} ${styles.chartCard}`} aria-labelledby="growth-title">
        <div className={styles.sectionHead}><h2 id="growth-title">نمو المنصة</h2><span className={styles.sectionMeta}>آخر ٣٠ يوم</span></div>
        <GrowthChart />
      </section>

      <div className={styles.analytics}>
        <section className={`${styles.card} ${styles.analyticsCard}`} aria-labelledby="tech-title">
          <div className={styles.sectionHead}><h2 id="tech-title">التقنيات الأكثر تعلّماً</h2><span className={styles.sectionMeta}>آخر ٣٠ يوم</span></div>
          <div className={styles.list}>{technologies.map(item => <div key={item.name} data-testid={`row-technology-${item.name.replace(/[^a-z]/gi, '-').toLowerCase()}`}><div className={styles.metricTop}><span className={styles.metricName}>{item.name}</span><span className={styles.metricCount}>{number(item.count)} طالب · {number(item.percent)}٪</span></div><div className={styles.track}><span className={styles.fill} style={{ width: `${item.percent}%`, '--bar-color': colors[item.color].foreground } as CSSProperties} /></div></div>)}</div>
        </section>
        <section className={`${styles.card} ${styles.analyticsCard}`} aria-labelledby="geo-title">
          <div className={styles.sectionHead}><h2 id="geo-title">التوزيع الجغرافي</h2><span className={styles.sectionMeta}>حسب البلد</span></div>
          <div className={styles.countryList}>{countries.map(item => <div key={item.name} data-testid={`row-country-${item.name}`}><div className={styles.countryTop}><div className={styles.countryMain}><span className={styles.flag} aria-hidden="true">{item.flag}</span><div><span className={styles.countryName}>{item.name}</span><span className={styles.countrySchool}>{item.schools}</span></div></div><strong className={styles.countryCount}>{number(item.count)}</strong></div><div className={styles.track}><span className={styles.fill} style={{ width: `${item.percent}%` }} /></div></div>)}</div>
        </section>
      </div>

      <section className={`${styles.card} ${styles.recommendations}`} aria-labelledby="recommended-title">
        <div className={styles.recommendHead}>
          <div><h2 id="recommended-title">مرشحون موصى بهم لك</h2><p>مبني على متطلباتك · Node.js Senior · الرياض</p></div>
          <div className={styles.filters} role="search" aria-label="تصفية المرشحين">
            <label className={styles.searchBox}><Search size={15} className={styles.searchIcon} aria-hidden="true" /><input className={styles.field} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="بحث بالاسم أو التخصص..." aria-label="بحث بالاسم أو التخصص" data-testid="input-candidate-search" /></label>
            <select className={`${styles.field} ${styles.select}`} value={tech} onChange={event => setTech(event.target.value)} aria-label="التصفية حسب التقنية" data-testid="select-technology"><option value="">كل التقنيات</option>{['Django', 'Node.js', 'React', 'Flutter', 'Laravel'].map(value => <option key={value} value={value}>{value}</option>)}</select>
            <select className={`${styles.field} ${styles.select}`} value={country} onChange={event => setCountry(event.target.value)} aria-label="التصفية حسب البلد" data-testid="select-country"><option value="">كل البلدان</option>{['السعودية', 'سوريا', 'الإمارات', 'مصر', 'الأردن'].map(value => <option key={value} value={value}>{value}</option>)}</select>
          </div>
        </div>
        <p className={styles.resultCount} aria-live="polite" data-testid="value-filtered-count">عرض {number(filtered.length)} من {number(candidates.length)} مرشحين · بيانات تجريبية</p>
        {filtered.length ? <div className={styles.candidateGrid}>{filtered.map(candidate => <article key={candidate.id} className={styles.candidate} tabIndex={0} role="button" aria-label={`عرض ملف ${candidate.name}`} onClick={() => openCandidate(candidate)} onKeyDown={event => onCardKey(event, candidate)} data-testid={`card-candidate-${candidate.id}`}>
          <div className={styles.candidateTop}><span className={styles.avatar} style={{ '--avatar-color': colors[candidate.avatar].foreground, '--avatar-bg': colors[candidate.avatar].background } as CSSProperties}>{candidate.initial}</span><div className={styles.candidateNameWrap}><span className={styles.candidateName}>{candidate.name}</span><span className={styles.candidatePlace}>{candidate.flag} {candidate.location} · {candidate.status}</span></div><span className={styles.match} data-testid={`value-match-${candidate.id}`}>{number(candidate.match)}٪ تطابق</span></div>
          <div className={styles.skills}>{candidate.skills.map(skill => <SkillTag key={skill.name} skill={skill} />)}</div>
          <div className={styles.candidateBottom}><span className={styles.readiness}>جاهزية المناقشة <strong>✓ {number(candidate.readiness)}٪</strong></span><div className={styles.cardActions}><button type="button" className={styles.smallButton} onClick={event => { event.stopPropagation(); video(); }} data-testid={`button-video-${candidate.id}`}>فيديو الدفاع قريباً</button><button type="button" className={`${styles.smallButton} ${styles.smallPrimary}`} onClick={event => { event.stopPropagation(); interview(candidate); }} data-testid={`button-interview-${candidate.id}`}>أرغب بمقابلت{candidate.feminine ? 'ها' : 'ه'}</button></div></div>
        </article>)}</div> : <div className={styles.empty} data-testid="state-no-candidates"><span className={styles.emptyIcon}><Search size={22} /></span><h3>لا يوجد مرشحون بهذه المواصفات</h3><p>جرّب تغيير الفلاتر</p><button className={styles.button} type="button" onClick={reset} data-testid="button-reset-filters"><RotateCcw size={14} /> إعادة تعيين الفلاتر</button></div>}
      </section>
      <aside className={styles.insight}><p><Info size={15} style={{ display:'inline-block',verticalAlign:'middle',marginLeft:7 }} /> الفرق مع LinkedIn: لا نعتمد على سير ذاتية وحدها؛ فكرة Talent Bridge هي توثيق جلسات التعلّم ودفاع المشروع قبل التواصل مع المرشح.</p><span className={styles.insightNote}>هذا العرض يستخدم بيانات محاكاة. فيديوهات الدفاع وطلبات المقابلات غير متاحة فعلياً بعد.</span></aside>
    </div>

    <div className={styles.toastRegion} aria-live="polite" aria-label="نشاط تجريبي محاكى">{toasts.map(toast => <div key={toast.id} className={styles.toast} data-testid={`toast-simulated-${toast.id}`}><span className={styles.toastMeta}>نشاط محاكى · بيانات تجريبية</span>{toast.message}</div>)}</div>

    {modalOpen && <div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget) closeDialog(); }} data-testid="overlay-dialog">
      <div className={`${styles.dialog} ${info ? styles.dialogCompact : ''}`} role="dialog" aria-modal="true" aria-labelledby="company-dialog-title" tabIndex={-1} ref={dialogRef} data-testid="dialog-company">
        {selected ? <>
          <div className={styles.dialogHead}><span className={styles.avatar} style={{ '--avatar-color': colors[selected.avatar].foreground, '--avatar-bg': colors[selected.avatar].background } as CSSProperties}>{selected.initial}</span><div className={styles.dialogIdentity}><h2 id="company-dialog-title">{selected.name}</h2><p>{selected.flag} {selected.location} · {selected.status}</p><p className={styles.status}>جاهز{selected.feminine ? 'ة' : ''} للتوظيف · تطابق {number(selected.match)}٪</p></div><button className={styles.close} type="button" onClick={closeDialog} aria-label="إغلاق" data-testid="button-close-dialog"><X size={18} /></button></div>
          <hr className={styles.divider} />
          <div className={styles.dialogSection}><h3>نبذة</h3><p>{selected.bio}</p></div>
          <div className={styles.dialogSection}><h3>التقنيات</h3><div className={styles.skills}>{[...selected.skills, { name: 'Docker', color: 'blue' as const }, { name: 'Git', color: 'teal' as const }].map(skill => <SkillTag key={skill.name} skill={skill} />)}</div></div>
          <div className={styles.dialogSection}><h3>الإحصائيات</h3><div className={styles.dialogStats}><div className={styles.dialogStat}><strong>{number(selected.sessions)}</strong><span>جلسة</span></div><div className={styles.dialogStat}><strong>{number(selected.readiness)}٪</strong><span>جاهزية</span></div><div className={styles.dialogStat}><strong>{number(selected.projects)}</strong><span>مشاريع</span></div></div></div>
          <div className={styles.dialogSection}><h3>فيديو الدفاع</h3><button type="button" className={styles.videoNotice} onClick={video} data-testid="button-modal-video"><span className={styles.playIcon}><Play size={14} fill="currentColor" /></span><span>فيديو الدفاع قريباً<small>لا يوجد تسجيل قابل للمشاهدة في العرض التجريبي</small></span></button></div>
          <div className={styles.dialogActions}><button type="button" className={`${styles.button} ${styles.primary}`} onClick={() => interview(selected)} data-testid="button-modal-contact"><Check size={15} /> تواصل الآن · تجربة فقط</button><button type="button" className={styles.button} onClick={() => toggleSaved(selected.id)} data-testid="button-save-candidate"><Bookmark size={15} fill={savedIds.includes(selected.id) ? 'currentColor' : 'none'} /> {savedIds.includes(selected.id) ? 'إزالة من المحفوظات' : 'حفظ للاحقاً'}</button></div>
        </> : info && <><div className={styles.dialogHead}><div className={styles.dialogIdentity}><h2 id="company-dialog-title">{info.title}</h2></div><button className={styles.close} type="button" onClick={closeDialog} aria-label="إغلاق" data-testid="button-close-dialog"><X size={18} /></button></div><p className={styles.dialogInfo} role="status" data-testid="status-demo-explanation">{info.description}</p><div className={styles.dialogActions}><button type="button" className={`${styles.button} ${styles.primary}`} onClick={closeDialog} data-testid="button-acknowledge-demo">فهمت</button></div></>}
      </div>
    </div>}
  </main>;
}