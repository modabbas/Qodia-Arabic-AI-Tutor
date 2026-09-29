import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeft, Copy, Download, ExternalLink, Search, UserPlus, X } from 'lucide-react';
import styles from './UniversityDashboard.module.css';

const arabicDigits = (value: string | number) => String(value).replace(/[0-9]/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
const formatNumber = (value: number) => arabicDigits(value.toLocaleString('en-US'));

// Demo-only fixture. In production, access should be restricted to university_admin.
const stats = [
  { label: 'إجمالي الطلاب', value: 342, suffix: '', change: '↑ ٢٨ هذا الأسبوع' },
  { label: 'جلسات مكتملة', value: 1847, suffix: '', change: '↑ ٩٪ مقابل الأسبوع الماضي' },
  { label: 'متوسط الجاهزية', value: 64, suffix: '٪', change: '↑ ٤ نقاط' },
  { label: 'جاهزون للتوظيف', value: 12, suffix: '', change: 'Talent Bridge Ready' },
] as const;

const concepts = [
  { name: 'on_delete=CASCADE', error: 73, nameTone: 'amber' },
  { name: 'Middleware Order', error: 68, nameTone: 'purple' },
  { name: 'JWT Refresh Tokens', error: 54, nameTone: 'blue' },
  { name: 'Async/Await Errors', error: 47, nameTone: 'teal' },
] as const;

const leaders = [
  { rank: 1, name: 'لينا الأحمد', university: 'جامعة دمشق', points: 4230, ours: true },
  { rank: 2, name: 'عمر الخالد', university: 'الملك سعود', points: 3910, ours: false },
  { rank: 3, name: 'أحمد ياسين', university: 'جامعة دمشق', points: 3840, ours: true },
  { rank: 4, name: 'مريم العلي', university: 'الملك عبدالعزيز', points: 3620, ours: false },
  { rank: 5, name: 'خالد الحسن', university: 'جامعة دمشق', points: 3540, ours: true },
] as const;

const students = [
  { id: 'lina', name: 'لينا الأحمد', project: 'حجز عيادات', tech: 'Django', sessions: 32, readiness: 87, activity: 'قبل ساعة', avatar: 'avatarBlue', techTone: 'techBlue' },
  { id: 'ahmad', name: 'أحمد ياسين', project: 'متجر إلكتروني', tech: 'Node.js', sessions: 28, readiness: 78, activity: 'قبل ٣ ساعات', avatar: 'avatarAmber', techTone: 'techAmber' },
  { id: 'khaled', name: 'خالد الحسن', project: 'إدارة مهام', tech: 'React', sessions: 24, readiness: 62, activity: 'قبل يوم', avatar: 'avatarPurple', techTone: 'techPurple' },
  { id: 'mohammad', name: 'محمد الشامي', project: 'تطبيق طقس', tech: 'Flutter', sessions: 6, readiness: 24, activity: 'قبل أسبوع', avatar: 'avatarTeal', techTone: 'techBlue' },
] as const;

function csvCell(value: string | number) {
  return `"${arabicDigits(value).replace(/"/g, '""')}"`;
}

function exportDemoCsv() {
  const rows: (string | number)[][] = [
    ['بيانات تجريبية فقط — ليست بيانات طلاب حقيقيين'],
    [],
    ['المؤشر', 'القيمة', 'التغير'],
    ...stats.map(item => [item.label, `${formatNumber(item.value)}${item.suffix}`, item.change]),
    [],
    ['المفاهيم الأصعب', 'نسبة الأخطاء'],
    ...concepts.map(item => [item.name, `${arabicDigits(item.error)}٪`]),
    [],
    ['الترتيب', 'الطالب', 'الجامعة', 'النقاط'],
    ...leaders.map(item => [item.rank, item.name, item.university, formatNumber(item.points)]),
    [],
    ['الطالب', 'المشروع', 'التقنية', 'الجلسات', 'الجاهزية', 'آخر نشاط'],
    ...students.map(item => [item.name, item.project, item.tech, item.sessions, `${arabicDigits(item.readiness)}٪`, item.activity]),
  ];
  const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'qodia-university-demo.csv';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function UniversityDashboard() {
  const [search, setSearch] = useState('');
  const [technology, setTechnology] = useState('all');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [showDataNote, setShowDataNote] = useState(false);
  const inviteTrigger = useRef<HTMLButtonElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const signupUrl = new URL(`${import.meta.env.BASE_URL.replace(/\/?$/, '/')}signup`, window.location.origin).href;

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return students.filter(student =>
      (technology === 'all' || student.tech === technology) &&
      (!term || [student.name, student.project, student.tech, student.activity].some(value => value.toLocaleLowerCase().includes(term)))
    );
  }, [search, technology]);

  useEffect(() => {
    if (!inviteOpen) return;
    copyButton.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      inviteTrigger.current?.focus();
    };
  }, [inviteOpen]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      setInviteOpen(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function copySignupUrl() {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopyStatus('copied');
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <main className={styles.page} dir="rtl" data-testid="page-university-dashboard">
      <div className={styles.wrap}>
        <header className={styles.masthead}>
          <div className={styles.identity}>
            <p className={styles.eyebrow}>قُوديا / مساحة الجامعة</p>
            <h1 data-testid="text-university-name">جامعة دمشق · كلية المعلوماتية</h1>
            <p className={styles.subtitle}>لوحة تحكم المشرف · الفصل الأول {arabicDigits(2026)}</p>
          </div>
          <div className={styles.actions}>
            <button className={styles.button} type="button" onClick={exportDemoCsv} data-testid="button-export-report">
              <Download size={15} aria-hidden="true" /> تصدير تقرير
            </button>
            <button ref={inviteTrigger} className={`${styles.button} ${styles.primary}`} type="button" onClick={() => { setCopyStatus('idle'); setInviteOpen(true); }} data-testid="button-invite-students">
              <UserPlus size={16} aria-hidden="true" /> دعوة طلاب
            </button>
          </div>
        </header>

        <div className={styles.demoNotice} role="note" data-testid="note-demo-data">
          <span className={styles.demoTag}>نسخة تجريبية</span>
          <span>البيانات المعروضة هنا توضيحية للعرض فقط، ولا تمثّل سجلات طلاب حقيقيين.</span>
        </div>

        <section className={styles.stats} aria-label="مؤشرات الجامعة">
          {stats.map((item, index) => (
            <article className={`${styles.card} ${styles.stat}`} key={item.label} data-testid={`card-stat-${index + 1}`}>
              <span className={styles.statLabel}>{item.label}</span>
              <strong className={styles.statValue} data-testid={`value-stat-${index + 1}`}>{formatNumber(item.value)}{item.suffix}</strong>
              <span className={`${styles.statChange} ${index === 3 ? styles.statNeutral : ''}`}>{item.change}</span>
            </article>
          ))}
        </section>

        <div className={styles.insights}>
          <section className={`${styles.card} ${styles.sectionCard}`} aria-labelledby="difficult-title">
            <div className={styles.sectionHead}>
              <h2 id="difficult-title">المفاهيم الأصعب</h2>
              <span className={styles.sectionMeta}>أعلى نسبة أخطاء</span>
            </div>
            <div className={styles.conceptList}>
              {concepts.map((concept, index) => {
                const tone = concept.error > 65 ? 'red' : 'amber';
                return (
                  <div key={concept.name} data-testid={`concept-${index + 1}`}>
                    <div className={styles.conceptTop}>
                      <span className={`${styles.conceptName} ${styles[concept.nameTone]}`} lang="en">{concept.name}</span>
                      <span className={`${styles.conceptPercent} ${styles[tone]}`} data-testid={`value-error-${index + 1}`}>{arabicDigits(concept.error)}٪</span>
                    </div>
                    <div className={styles.bar} role="meter" aria-label={`نسبة الأخطاء في ${concept.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={concept.error} aria-valuetext={`${arabicDigits(concept.error)} بالمئة`}>
                      <span className={`${styles.barFill} ${styles[tone]}`} style={{ width: `${concept.error}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.recommendation} data-testid="note-recommendation">
              💡 توصية: أضيفوا محاضرة إضافية عن <code lang="en">on_delete</code> في المنهج
            </div>
          </section>

          <section className={`${styles.card} ${styles.sectionCard}`} aria-labelledby="leaders-title">
            <div className={styles.sectionHead}>
              <h2 id="leaders-title">المتصدرون · العالم العربي</h2>
              <span className={`${styles.sectionMeta} ${styles.sectionMetaGreen}`}>٣ من جامعتك في القمة</span>
            </div>
            <ol className={styles.leaderList}>
              {leaders.map(leader => (
                <li className={`${styles.leader} ${leader.ours ? styles.ours : ''}`} key={leader.rank} data-testid={`row-leader-${leader.rank}`}>
                  <span className={`${styles.rank} ${leader.rank === 1 ? styles.gold : leader.rank === 2 ? styles.silver : leader.rank === 3 ? styles.bronze : ''}`} aria-label={`المرتبة ${arabicDigits(leader.rank)}`}>{arabicDigits(leader.rank)}</span>
                  <span className={styles.leaderInfo}>
                    <span className={styles.leaderName}>{leader.name}{leader.rank === 1 && <span className={styles.trophy} aria-label="المركز الأول"> 🏆</span>}</span>
                    <span className={styles.leaderSchool}>{leader.university}</span>
                  </span>
                  <span className={styles.leaderPoints} data-testid={`value-leader-points-${leader.rank}`}>{formatNumber(leader.points)} نقطة</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section className={`${styles.card} ${styles.tableCard}`} aria-labelledby="students-title">
          <div className={styles.tableHeader}>
            <h2 id="students-title">تتبع الطلاب الفرديّين</h2>
            <div className={styles.tableTools}>
              <label className={styles.searchBox}>
                <Search size={15} className={styles.searchIcon} aria-hidden="true" />
                <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ابحث عن طالب أو مشروع..." aria-label="ابحث عن طالب أو مشروع" data-testid="input-search-students" />
              </label>
              <select className={styles.filter} value={technology} onChange={event => setTechnology(event.target.value)} aria-label="تصفية حسب التقنية" data-testid="select-technology">
                <option value="all">كل التقنيات</option>
                <option value="Django">Django</option>
                <option value="Node.js">Node.js</option>
                <option value="React">React</option>
                <option value="Flutter">Flutter</option>
              </select>
            </div>
          </div>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead><tr><th scope="col">الطالب</th><th scope="col">المشروع</th><th scope="col">التقنية</th><th scope="col">الجلسات</th><th scope="col">جاهزية</th><th scope="col">آخر نشاط</th></tr></thead>
              <tbody>
                {filteredStudents.map(student => {
                  const readinessTone = student.readiness >= 75 ? 'green' : student.readiness >= 45 ? 'amber' : 'red';
                  return (
                    <tr key={student.id} className={student.readiness < 45 ? styles.failingRow : student.readiness >= 75 ? styles.successRow : ''} data-testid={`row-student-${student.id}`}>
                      <td><span className={styles.student}><span className={`${styles.avatar} ${styles[student.avatar]}`} aria-hidden="true">{student.name[0]}</span>{student.name}</span></td>
                      <td>{student.project}</td>
                      <td><span className={`${styles.tech} ${styles[student.techTone]}`} lang="en">{student.tech}</span></td>
                      <td data-testid={`value-sessions-${student.id}`}>{arabicDigits(student.sessions)}</td>
                      <td><span className={`${styles.readiness} ${styles[readinessTone]}`} data-testid={`value-readiness-${student.id}`}><span className={styles.bar} aria-hidden="true"><span className={styles.barFill} style={{ width: `${student.readiness}%` }} /></span>{arabicDigits(student.readiness)}٪</span></td>
                      <td className={styles.activity}>{student.activity}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className={styles.mobileList} aria-label="سجلات الطلاب">
            {filteredStudents.map(student => {
              const readinessTone = student.readiness >= 75 ? 'green' : student.readiness >= 45 ? 'amber' : 'red';
              return (
                <article className={`${styles.mobileStudent} ${student.readiness < 45 ? styles.failingRow : student.readiness >= 75 ? styles.successRow : ''}`} key={student.id} data-testid={`card-student-${student.id}`}>
                  <div className={styles.mobileStudentHead}>
                    <div className={styles.mobileName}>
                      <span className={styles.mobileSmallLabel}>الطالب</span>
                      <span className={styles.student}><span className={`${styles.avatar} ${styles[student.avatar]}`} aria-hidden="true">{student.name[0]}</span>{student.name}</span>
                    </div>
                    <div className={styles.mobileTech}>
                      <span className={styles.mobileSmallLabel}>التقنية</span>
                      <span className={`${styles.tech} ${styles[student.techTone]}`} lang="en">{student.tech}</span>
                    </div>
                  </div>
                  <dl className={styles.mobileFields}>
                    <div className={styles.mobileField}><dt>المشروع</dt><dd>{student.project}</dd></div>
                    <div className={styles.mobileField}><dt>الجلسات</dt><dd data-testid={`value-mobile-sessions-${student.id}`}>{arabicDigits(student.sessions)}</dd></div>
                    <div className={styles.mobileField}><dt>جاهزية</dt><dd className={`${styles.readiness} ${styles[readinessTone]}`} data-testid={`value-mobile-readiness-${student.id}`}><span className={styles.bar} aria-hidden="true"><span className={styles.barFill} style={{ width: `${student.readiness}%` }} /></span>{arabicDigits(student.readiness)}٪</dd></div>
                    <div className={styles.mobileField}><dt>آخر نشاط</dt><dd className={styles.activity}>{student.activity}</dd></div>
                  </dl>
                </article>
              );
            })}
          </div>
          {filteredStudents.length === 0 && <div className={styles.empty} role="status" data-testid="status-no-students">لا توجد نتائج مطابقة في بيانات العرض التجريبي. جرّب بحثًا أو تقنية أخرى.</div>}
          <div className={styles.tableFooter}>
            <span data-testid="text-student-count">عرض {arabicDigits(filteredStudents.length)} من {arabicDigits(342)} طالب</span>
            <button type="button" className={styles.viewAll} onClick={() => setShowDataNote(value => !value)} aria-expanded={showDataNote} data-testid="button-view-all-students">
              شاهد الكل <ArrowLeft size={14} aria-hidden="true" />
            </button>
          </div>
          {showDataNote && <p className={styles.dataNote} role="status" data-testid="note-all-students">هذه نسخة تجريبية تحتوي على {arabicDigits(students.length)} سجلات طلاب توضيحية فقط. العدد الإجمالي المعروض مؤشر تجريبي، ولا توجد قائمة إضافية أو بيانات طلاب حقيقية متاحة هنا.</p>}
        </section>
      </div>

      {inviteOpen && (
        <div className={styles.overlay} onMouseDown={event => { if (event.target === event.currentTarget) setInviteOpen(false); }}>
          <div ref={dialog} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="invite-title" aria-describedby="invite-description" onKeyDown={handleDialogKeyDown} data-testid="dialog-invite-students">
            <div className={styles.dialogTop}>
              <h2 id="invite-title">دعوة الطلاب إلى قُوديا</h2>
              <button className={styles.close} type="button" onClick={() => setInviteOpen(false)} aria-label="إغلاق نافذة الدعوة" data-testid="button-close-invite"><X size={17} aria-hidden="true" /></button>
            </div>
            <p id="invite-description">شارك رابط التسجيل مع طلابك عبر القناة التي تستخدمونها. لا تُرسَل أي دعوات من داخل هذه النسخة التجريبية.</p>
            <span className={styles.urlLabel}>رابط التسجيل</span>
            <div className={styles.urlBox} dir="ltr" data-testid="text-signup-url">{signupUrl}</div>
            <div className={styles.dialogActions}>
              <button ref={copyButton} className={`${styles.button} ${styles.primary}`} type="button" onClick={() => { void copySignupUrl(); }} data-testid="button-copy-signup-url"><Copy size={15} aria-hidden="true" /> نسخ الرابط</button>
              <a className={styles.signupLink} href={signupUrl} target="_blank" rel="noopener noreferrer" data-testid="link-open-signup">فتح صفحة التسجيل <ExternalLink size={14} aria-hidden="true" /></a>
            </div>
            {copyStatus === 'copied' && <div className={styles.copyStatus} role="status" data-testid="status-copy-success">نُسخ الرابط. يمكنك مشاركته مع طلابك.</div>}
            {copyStatus === 'error' && <div className={`${styles.copyStatus} ${styles.copyError}`} role="status" data-testid="status-copy-error">تعذّر النسخ تلقائيًا. انسخ الرابط الظاهر أعلاه يدويًا.</div>}
          </div>
        </div>
      )}
    </main>
  );
}