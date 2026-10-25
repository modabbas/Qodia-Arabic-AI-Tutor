import { ArrowLeft, Check, Code2 } from 'lucide-react';
import { Link } from 'wouter';
import type { StoreProject } from '@workspace/api-client-react';
import { formatUsd } from './store-utils';

export function StatusBadge({ status, testId }: { status: StoreProject['status']; testId?: string }) {
  return status === 'coming_soon'
    ? <span className="st-badge st-badge-soon" data-testid={testId}><i aria-hidden="true" /> قريبًا</span>
    : <span className="st-badge st-badge-open" data-testid={testId}><i aria-hidden="true" /> تسجيل الاهتمام مفتوح</span>;
}

export function Placeholder({ tech, title }: { tech: string; title: string }) {
  return (
    <div className="st-placeholder" role="img" aria-label={`لا توجد صورة بعد لمشروع ${title}`}>
      <span className="st-ph-tech" dir="ltr">{tech}</span>
      <div className="st-ph-lines" aria-hidden="true"><i /><i /><i /><i /></div>
      <span className="st-ph-note">لا صور معروضة بعد</span>
    </div>
  );
}

export function Prices({ project, large }: { project: StoreProject; large?: boolean }) {
  return (
    <dl className={`st-prices${large ? ' st-prices-large' : ''}`}>
      <div><dt>للطالب:</dt><dd data-testid={`text-price-student-${project.id}`} dir="ltr">{formatUsd(project.price_student_usd)}</dd></div>
      <div><dt>للمعاهد: من</dt><dd data-testid={`text-price-institute-${project.id}`} dir="ltr">{formatUsd(project.price_institute_usd)}</dd></div>
    </dl>
  );
}

export function ProjectCard({ project }: { project: StoreProject }) {
  const firstThree = project.includes.slice(0, 3);
  const more = project.includes.length > 3;
  const image = project.images[0];
  return (
    <article className="st-card" data-testid={`card-project-${project.id}`}>
      <div className="st-card-media">
        {image ? <img src={image} alt={project.title_ar} loading="lazy" /> : <Placeholder tech={project.tech_stack} title={project.title_ar} />}
        <StatusBadge status={project.status} testId={`status-project-${project.id}`} />
      </div>
      <div className="st-card-body">
        <div className="st-card-tags">
          <span className="st-tag st-tag-tech" dir="ltr"><Code2 size={13} aria-hidden="true" /> {project.tech_stack}</span>
          <span className="st-tag">{project.difficulty}</span>
        </div>
        <h3 data-testid={`text-title-${project.id}`}>{project.title_ar}</h3>
        <p className="st-card-en" dir="ltr">{project.title_en}</p>
        <p className="st-card-desc">{project.description_ar}</p>
        {firstThree.length > 0 && (
          <div className="st-includes">
            <span>يتضمن</span>
            <ul>
              {firstThree.map((item) => <li key={item}><Check size={13} aria-hidden="true" /> {item}</li>)}
              {more && <li className="st-more">والمزيد</li>}
            </ul>
          </div>
        )}
        <div className="st-card-foot">
          <Prices project={project} />
          <Link href={`/store/${project.slug}`} className="st-details" data-testid={`link-details-${project.id}`}>التفاصيل <ArrowLeft size={15} /></Link>
        </div>
      </div>
    </article>
  );
}

export function CardSkeleton() {
  return (
    <div className="st-card st-card-skel" aria-hidden="true">
      <div className="skeleton" style={{ height: 170, borderRadius: 0 }} />
      <div className="st-card-body">
        <div className="skeleton" style={{ width: 110, height: 12 }} />
        <div className="skeleton" style={{ width: '80%', height: 22, marginTop: 18 }} />
        <div className="skeleton" style={{ width: '100%', height: 54, marginTop: 14 }} />
        <div className="skeleton" style={{ width: '60%', height: 14, marginTop: 18 }} />
      </div>
    </div>
  );
}
