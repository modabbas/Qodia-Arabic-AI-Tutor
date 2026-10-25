import { useMemo, useState } from 'react';
import { FileCode2, MessagesSquare, RotateCcw, ShieldCheck, BadgeCheck } from 'lucide-react';
import { useGetStoreProjects } from '@workspace/api-client-react';
import { StoreLayout } from '@/components/store/StoreChrome';
import { CardSkeleton, ProjectCard } from '@/components/store/ProjectBits';

const ALL = 'all';
const difficultyOrder = ['مبتدئ', 'متوسط', 'متقدم'];

export default function StoreCatalog() {
  const { data, isLoading, isError, refetch, isFetching } = useGetStoreProjects();
  const [tech, setTech] = useState(ALL);
  const [level, setLevel] = useState(ALL);

  const projects = useMemo(() => data ?? [], [data]);
  const techs = useMemo(() => Array.from(new Set(projects.map((p) => p.tech_stack))).sort(), [projects]);
  const levels = useMemo(() => difficultyOrder.filter((d) => projects.some((p) => p.difficulty === d)), [projects]);
  const filtered = useMemo(() => projects.filter((p) => (tech === ALL || p.tech_stack === tech) && (level === ALL || p.difficulty === level)), [projects, tech, level]);

  return (
    <StoreLayout>
      <section className="st-hero qp-shell" aria-labelledby="store-title">
        <span className="qp-kicker kicker-green"><i /> متجر كوديا · المرحلة الأولى</span>
        <h1 id="store-title">مشاريع جاهزة، مع شرح كامل واختبار فهم</h1>
        <p className="st-lede">كوديا لا يقدّم كودًا بلا حزمة شرح. كل مشروع هنا مصمم لتفهم ملفاته وتدافع عن قراراته — لا لتسلّمه وتمشي.</p>
        <ul className="st-trust" aria-label="ما يأتي مع كل مشروع" data-testid="list-trust">
          <li><FileCode2 size={18} aria-hidden="true" /> كل مشروع يأتي مع شرح لكل ملف</li>
          <li><MessagesSquare size={18} aria-hidden="true" /> أسئلة مناقشة جاهزة</li>
          <li><BadgeCheck size={18} aria-hidden="true" /> بطاقة فهم بعد اجتياز الاختبار</li>
        </ul>
        <p className="qp-honesty-note"><ShieldCheck size={15} /> لا يوجد شراء أو دفع حاليًا — يمكنك فقط تسجيل اهتمامك بأي مشروع.</p>
      </section>

      <section className="st-catalog qp-section" aria-labelledby="catalog-title">
        <div className="qp-shell">
          <div className="st-catalog-head">
            <h2 id="catalog-title">الكتالوج</h2>
            {!isLoading && !isError && projects.length > 0 && (
              <div className="st-filters" role="group" aria-label="تصفية المشاريع">
                <label>
                  <span>التقنية</span>
                  <select className="field" value={tech} onChange={(e) => setTech(e.target.value)} data-testid="select-tech">
                    <option value={ALL}>الكل</option>
                    {techs.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label>
                  <span>المستوى</span>
                  <select className="field" value={level} onChange={(e) => setLevel(e.target.value)} data-testid="select-difficulty">
                    <option value={ALL}>الكل</option>
                    {levels.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              </div>
            )}
          </div>

          {isLoading && <div className="st-grid" role="status" aria-label="جارٍ تحميل المشاريع" data-testid="status-loading"><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>}

          {isError && (
            <div className="st-state" role="alert" data-testid="status-error">
              <strong>تعذّر تحميل المشاريع.</strong>
              <p>لا نعرض أي بيانات بديلة. تأكد من اتصالك وحاول مرة ثانية.</p>
              <button type="button" className="qp-button qp-button-quiet" onClick={() => refetch()} disabled={isFetching} data-testid="button-retry"><RotateCcw size={16} /> حاول مجددًا</button>
            </div>
          )}

          {!isLoading && !isError && projects.length === 0 && (
            <div className="st-state" data-testid="status-empty">
              <strong>لا توجد مشاريع منشورة بعد.</strong>
              <p>نجهّز أول المشاريع مع حزم الشرح. عُد قريبًا.</p>
            </div>
          )}

          {!isLoading && !isError && projects.length > 0 && filtered.length === 0 && (
            <div className="st-state" data-testid="status-no-results">
              <strong>لا مشاريع تطابق هذا الاختيار.</strong>
              <button type="button" className="qp-button qp-button-quiet" onClick={() => { setTech(ALL); setLevel(ALL); }} data-testid="button-clear-filters">إظهار كل المشاريع</button>
            </div>
          )}

          {filtered.length > 0 && !isError && (
            <>
              <p className="st-count-line" aria-live="polite">{filtered.length} من {projects.length} مشروع</p>
              <div className="st-grid">{filtered.map((p) => <ProjectCard key={p.id} project={p} />)}</div>
            </>
          )}
        </div>
      </section>
    </StoreLayout>
  );
}
