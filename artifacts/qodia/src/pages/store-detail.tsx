import { ArrowRight, Check, Code2, RotateCcw } from 'lucide-react';
import { Link } from 'wouter';
import { useGetStoreProject } from '@workspace/api-client-react';
import { StoreLayout } from '@/components/store/StoreChrome';
import { Placeholder, Prices, StatusBadge } from '@/components/store/ProjectBits';
import { InterestPanel } from '@/components/store/InterestForm';
import { errorStatus } from '@/components/store/store-utils';

const steps = [
  { n: '٠١', title: 'اشترِ المشروع', text: 'عند فتح الشراء لاحقًا. اليوم يمكنك تسجيل اهتمامك فقط — لا دفع الآن.' },
  { n: '٠٢', title: 'افهمه ملفًا ملفًا', text: 'شرح لكل ملف: ماذا يفعل، ولماذا كُتب بهذه الطريقة.' },
  { n: '٠٣', title: 'اجتز المناقشة واحصل على بطاقة الفهم', text: 'أسئلة مناقشة تختبر فهمك، وبطاقة فهم بعد الاجتياز.' },
];

export default function StoreDetail({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const { data: project, isLoading, isError, error, refetch, isFetching } = useGetStoreProject(slug, { query: { retry: (count, err) => errorStatus(err) !== 404 && count < 2, queryKey: ['/api/store/projects/' + slug] } });
  const notFound = isError && errorStatus(error) === 404;

  return (
    <StoreLayout>
      <div className="qp-shell st-detail">
        <Link href="/store" className="st-back" data-testid="link-back-store"><ArrowRight size={15} /> كل المشاريع</Link>

        {isLoading && (
          <div role="status" aria-label="جارٍ التحميل" data-testid="status-loading">
            <div className="skeleton" style={{ width: 120, height: 14, marginTop: 30 }} />
            <div className="skeleton" style={{ width: 'min(520px, 90%)', height: 48, marginTop: 18 }} />
            <div className="skeleton" style={{ width: '100%', height: 220, marginTop: 28 }} />
          </div>
        )}

        {notFound && (
          <div className="st-state" role="alert" data-testid="status-not-found">
            <span className="st-404" dir="ltr">404</span>
            <strong>هذا المشروع غير موجود أو لم يُنشر بعد.</strong>
            <Link href="/store" className="qp-button qp-button-quiet" data-testid="link-404-store">العودة إلى المتجر</Link>
          </div>
        )}

        {isError && !notFound && (
          <div className="st-state" role="alert" data-testid="status-error">
            <strong>تعذّر تحميل المشروع.</strong>
            <p>تأكد من اتصالك وحاول مرة ثانية.</p>
            <button type="button" className="qp-button qp-button-quiet" onClick={() => refetch()} disabled={isFetching} data-testid="button-retry"><RotateCcw size={16} /> حاول مجددًا</button>
          </div>
        )}

        {project && !isError && (
          <article aria-labelledby="project-title">
            <div className="st-detail-grid">
              <div className="st-detail-copy">
                <div className="st-card-tags">
                  <StatusBadge status={project.status} testId="status-project" />
                  <span className="st-tag st-tag-tech" dir="ltr"><Code2 size={13} aria-hidden="true" /> {project.tech_stack}</span>
                  <span className="st-tag">{project.difficulty}</span>
                </div>
                <h1 id="project-title" data-testid="text-project-title">{project.title_ar}</h1>
                <p className="st-card-en" dir="ltr">{project.title_en}</p>
                <p className="st-detail-desc" data-testid="text-project-description">{project.description_ar}</p>
                <Prices project={project} large />
                <InterestPanel project={project} />
                <p className="st-form-note">{project.status === 'available' ? 'الشراء غير مفعّل في هذه المرحلة — سجّل اهتمامك وسنتواصل معك.' : 'المشروع قريبًا. سجّل اهتمامك لنبلغك عند التوفر.'}</p>
              </div>
              <div className="st-detail-media">
                {project.images.length > 0
                  ? <div className="st-gallery">{project.images.map((src, i) => <img key={src} src={src} alt={`${project.title_ar} — صورة ${i + 1}`} loading="lazy" />)}</div>
                  : <Placeholder tech={project.tech_stack} title={project.title_ar} />}
              </div>
            </div>

            <section className="st-block" aria-labelledby="includes-title">
              <h2 id="includes-title">يتضمن</h2>
              {project.includes.length > 0
                ? <ul className="st-includes-full">{project.includes.map((item) => <li key={item}><Check size={15} aria-hidden="true" /> {item}</li>)}</ul>
                : <p className="qp-muted">ستُضاف تفاصيل الحزمة قريبًا.</p>}
            </section>

            <section className="st-block" aria-labelledby="how-title">
              <h2 id="how-title">كيف تشتغل</h2>
              <ol className="st-steps">
                {steps.map((s) => <li key={s.n}><span className="st-step-n" aria-hidden="true">{s.n}</span><h3>{s.title}</h3><p>{s.text}</p></li>)}
              </ol>
            </section>
          </article>
        )}
      </div>
    </StoreLayout>
  );
}
