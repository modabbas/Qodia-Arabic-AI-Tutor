import { useState } from 'react';
import type { QueryObserverResult } from '@tanstack/react-query';
import { CheckCircle2, CircleDashed, Lock, RefreshCw, RotateCcw, PlayCircle } from 'lucide-react';
import { type LearningConcept, type LearningMap } from '@workspace/api-client-react';

const nf = new Intl.NumberFormat('ar-EG');
export const num = (n: number) => nf.format(n);

const labels = { completed: 'مكتمل', in_progress: 'قيد التعلم', needs_review: 'يحتاج مراجعة', planned: 'مخطط له' } as const;
type Tone = 'done' | 'current' | 'review' | 'locked' | 'planned';
export function toneOf(c: LearningConcept): Tone {
  if (c.status === 'needs_review' || (c.status === 'completed' && c.mastery_score !== null && c.mastery_score < 70)) return 'review';
  if (c.status === 'completed') return 'done';
  if (c.is_locked) return 'locked';
  if (c.status === 'in_progress') return 'current';
  return 'planned';
}
function StatusIcon({ tone, size = 13 }: { tone: Tone; size?: number }) {
  const p = { size, 'aria-hidden': true } as const;
  return tone === 'done' ? <CheckCircle2 {...p} /> : tone === 'review' ? <RotateCcw {...p} /> : tone === 'locked' ? <Lock {...p} /> : tone === 'current' ? <PlayCircle {...p} /> : <CircleDashed {...p} />;
}
const statusText = (c: LearningConcept) => c.is_locked && c.status === 'planned' ? 'مقفل' : labels[c.status];

export type FileConceptInfo = { concepts: LearningConcept[]; locked: boolean; tone: Tone; explanation: string };
export function conceptsByFile(map: LearningMap | undefined): Map<string, FileConceptInfo> {
  const out = new Map<string, FileConceptInfo>();
  if (!map) return out;
  const groups = new Map<string, LearningConcept[]>();
  map.concepts.forEach(c => groups.set(c.target_file, [...(groups.get(c.target_file) ?? []), c]));
  groups.forEach((concepts, file) => {
    const locked = concepts.every(c => c.is_locked && c.status !== 'completed');
    const best = concepts.find(c => !c.is_locked) ?? concepts[0]!;
    const unmet = Array.from(new Set(concepts.flatMap(c => c.unmet_prerequisites)));
    out.set(file, { concepts, locked, tone: locked ? 'locked' : toneOf(best),
      explanation: locked ? `مقفل حتى تتعلم: ${unmet.join('، ') || 'المتطلبات السابقة'}` : `${best.name_ar} · ${statusText(best)}${best.mastery_score !== null ? ` · إتقان ${num(Math.round(best.mastery_score))}٪` : ''}` });
  });
  return out;
}

export function TreeConceptDisclosure({ info, id }: { info: FileConceptInfo; id: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={`lp-badge lp-disclosure lp-${info.tone}`} aria-expanded={open} aria-controls={`tip-${id}`}
      aria-label={`${open ? 'إخفاء' : 'عرض'} تفاصيل المفهوم: ${info.explanation}`} onClick={() => setOpen(v => !v)}
      onBlur={() => setOpen(false)} data-testid={`button-file-concept-${id}`}><StatusIcon tone={info.tone} size={13} /></button>
    <div role="note" id={`tip-${id}`} className={`project-tree-tip ${open ? 'is-open' : ''}`} data-testid={`tooltip-file-${id}`}>{info.explanation}</div>
  </>;
}

type LearningMapQuery = { data?: LearningMap; isLoading: boolean; isError: boolean; refetch: () => Promise<QueryObserverResult<LearningMap, unknown>> };

export function LearningPathPanel({ map: q }: { map: LearningMapQuery }) {
  const [open, setOpen] = useState(false);
  const map = q.data;
  // Studied = completed, needs_review (low mastery but still studied), or a saved session with a score.
  const done = map?.concepts.filter(c => c.status === 'completed' || c.status === 'needs_review' || (c.session_id !== null && c.mastery_score !== null)) ?? [];
  const scored = done.filter(c => c.mastery_score !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, c) => s + (c.mastery_score ?? 0), 0) / scored.length) : null;
  const review = map?.concepts.filter(c => toneOf(c) === 'review').length ?? 0;
  return <section className="project-history lp-panel" aria-label="مسار التعلم" data-testid="section-learning-path">
    <span className="eyebrow">مسار التعلّم</span><h2>خريطة المفاهيم</h2>
    <p>حالة المفاهيم منفصلة عن ملفات مشروعك؛ إتمام مفهوم لا يعني أن ملفه كُتب.</p>
    {q.isLoading && <p className="lp-note" role="status" data-testid="status-learning-map-loading">نجهّز خريطة مفاهيمك. قد تستغرق المرة الأولى حتى ١٥ ثانية، وبقية الصفحة جاهزة للاستخدام.</p>}
    {q.isError && <div className="lp-error" role="alert"><span>تعذر تحميل خريطة التعلم.</span><button type="button" className="btn btn-outline" onClick={() => { void q.refetch(); }} data-testid="button-learning-map-retry"><RefreshCw size={14} /> أعد المحاولة</button></div>}
    {map && <>
      <div className="lp-stats">
        <div><strong data-testid="text-learned-count">{num(done.length)}<small> / {num(map.concepts.length)}</small></strong><span>مفاهيم تعلمتها</span></div>
        <div><strong data-testid="text-average-mastery">{avg === null ? '—' : `${num(avg)}٪`}</strong><span>متوسط إتقان ما تعلمته</span></div>
        <div><strong data-testid="text-review-count">{num(review)}</strong><span>تحتاج مراجعة</span></div>
      </div>
      <p className="lp-note" data-testid="text-learning-map-source">{map.source === 'gemini' ? 'خريطة مولّدة لمشروعك.' : 'خريطة قياسية احتياطية (غير مخصصة بالذكاء الاصطناعي).'}</p>
      <button type="button" className="btn btn-outline" aria-expanded={open} onClick={() => setOpen(v => !v)} data-testid="button-toggle-full-map">{open ? 'إخفاء الخريطة الكاملة' : `عرض الخريطة الكاملة (${num(map.concepts.length)})`}</button>
      {open && <ol className="lp-list" data-testid="list-full-learning-map">{[...map.concepts].sort((a, b) => a.planned_day - b.planned_day).map(c => {
        const t = toneOf(c);
        return <li key={c.id} className={`lp-item lp-${t}`} data-testid={`card-concept-${c.id}`}>
          <div className="lp-item-top"><strong>{c.name_ar}</strong><bdi className="mono">{c.name_en}</bdi>
            <span className={`lp-chip lp-${t}`} data-testid={`status-concept-${c.id}`}><StatusIcon tone={t} /> {statusText(c)}</span></div>
          <p>{c.why_important}</p>
          <div className="lp-meta"><span>اليوم {num(c.planned_day)}</span><span>الصعوبة {num(c.difficulty)}</span>
            <span data-testid={`text-mastery-${c.id}`}>{c.mastery_score === null ? 'بلا درجة إتقان' : `إتقان ${num(Math.round(c.mastery_score))}٪`}</span>
            <bdi className="mono">{c.target_file}</bdi></div>
          {c.unmet_prerequisites.length > 0 && <p className="lp-prereq">المتطلبات: {c.unmet_prerequisites.join('، ')}</p>}
        </li>; })}</ol>}
    </>}
  </section>;
}
