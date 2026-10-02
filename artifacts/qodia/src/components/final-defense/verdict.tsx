import { useState } from 'react';
import { Download, LoaderCircle, RotateCcw, TriangleAlert, Check, X } from 'lucide-react';
import { Link } from 'wouter';
import { getGetDefenseSummaryQueryKey, useGetDefenseSummary, type DefenseSimulation } from '@workspace/api-client-react';
import { downloadDefensePdf } from '@/lib/defense-pdf';
import { ProfessorAvatar, professorKey } from './professors';

export const ar = (n: number) => n.toLocaleString('ar-EG');

export function Disclaimer({ source }: { source: 'gemini' | 'curated' }) {
  return <>
    {source === 'curated' && <p className="fd-curated" data-testid="text-source-curated">أسئلة هذه المحاكاة مأخوذة من مجموعة منسّقة مسبقاً لأن توليد الأسئلة المخصصة لم يتوفر الآن.</p>}
    <p className="fd-disclaimer">لجنة افتراضية للتدريب فقط. الدرجات تقديرية داخل المحاكاة، وليست مؤشراً على نجاحك الأكاديمي الفعلي ولا دليلاً على اكتمال بناء مشروعك.</p>
  </>;
}

export function Verdict({ sim, onNew }: { sim: DefenseSimulation; onNew: () => void }) {
  const summary = useGetDefenseSummary({ query: { queryKey: getGetDefenseSummaryQueryKey() } });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const passed = sim.questions.filter(q => q.would_pass === true).length;
  const download = async () => {
    if (!summary.data) return;
    setPdfBusy(true); setPdfError(null);
    try { await downloadDefensePdf(sim, summary.data); }
    catch (e) { setPdfError(e instanceof Error && e.message ? `تعذّر إنشاء التقرير: ${e.message}` : 'تعذّر إنشاء تقرير PDF. حاول مرة ثانية.'); }
    finally { setPdfBusy(false); }
  };
  return <div className="fd-verdict" data-testid="section-verdict">
    <div style={{ textAlign: 'center' }}>
      <span className="eyebrow">انتهت المناقشة / لجنة افتراضية</span>
      <h1 style={{ fontSize: 'clamp(30px,6vw,48px)', margin: '12px 0' }}>قرار اللجنة</h1>
      <div className="fd-big" data-testid="text-overall-score">{sim.overall_score === null ? '—' : ar(Math.round(sim.overall_score))}</div>
      <p className="fd-sub">الدرجة التقديرية من ١٠٠ — اجتزت {ar(passed)} من ٥ أسئلة</p>
    </div>
    <div className="fd-card" style={{ maxWidth: 'none' }}>
      <span className="eyebrow">رأي اللجنة</span>
      <p style={{ fontSize: 18, lineHeight: 2, margin: '10px 0 0' }} data-testid="text-verdict">{sim.verdict ?? 'لم تُسجَّل ملاحظات ختامية.'}</p>
      {sim.weak_concepts.length > 0 && <div style={{ marginTop: 16 }} data-testid="list-weak-concepts"><div style={{ color: '#e6a66d', display: 'flex', gap: 7, alignItems: 'center', fontSize: 14, marginBottom: 8 }}><TriangleAlert size={16} /> تحتاج مراجعة</div><div className="fd-rules" style={{ justifyContent: 'flex-start' }}>{sim.weak_concepts.map(c => <span key={c}>{c}</span>)}</div></div>}
    </div>
    {sim.questions.map(q => <article className="fd-detail" key={q.question_number} data-testid={`card-result-${q.question_number}`}>
      <div className="fd-qhead"><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><ProfessorAvatar who={professorKey(q.professor)} size={40} /><div><strong>السؤال {ar(q.question_number)} — {q.professor}</strong><div className="fd-meta"><span>{q.concept_tested}</span><span className="mono">{q.file_reference}</span></div></div></div>
        <div style={{ textAlign: 'left' }}><span className="mono" style={{ fontSize: 22, fontWeight: 700 }}>{q.points === null ? '—' : ar(q.points)}</span><div className={`fd-pass ${q.would_pass ? 'y' : 'n'}`}>{q.would_pass ? <><Check size={12} /> اجتاز</> : <><X size={12} /> لم يجتز</>}</div></div></div>
      <h3>{q.question_text}</h3>
      <p><strong>إجابتك:</strong> {q.student_answer?.trim() ? q.student_answer : 'لم تُسجَّل إجابة.'}</p>
      {q.mini_feedback && <p><strong>ملاحظة اللجنة:</strong> {q.mini_feedback}</p>}
      <div className="fd-two"><div className="fd-list good"><h4>نقاط القوة</h4><ul>{q.strengths.length ? q.strengths.map((s, i) => <li key={i}>{s}</li>) : <li>لا شيء مسجّل</li>}</ul></div><div className="fd-list bad"><h4>نقاط الضعف</h4><ul>{q.weaknesses.length ? q.weaknesses.map((s, i) => <li key={i}>{s}</li>) : <li>لا شيء مسجّل</li>}</ul></div></div>
      {q.ideal_answer_points.length > 0 && <div className="fd-ideal fd-list"><h4>نقاط الإجابة المتوقعة</h4><ul>{q.ideal_answer_points.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
    </article>)}
    <Disclaimer source={sim.source} />
    {pdfError && <p className="fd-error" role="alert" data-testid="text-pdf-error">{pdfError}</p>}
    <div className="fd-actions">
      <button className="btn btn-primary" onClick={() => { void download(); }} disabled={pdfBusy || !summary.data} data-testid="button-download-pdf">{pdfBusy ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />} تحميل التقرير PDF</button>
      <button className="btn btn-outline" onClick={onNew} data-testid="button-new-simulation"><RotateCcw size={17} /> محاكاة جديدة</button>
      <Link href="/dashboard" className="btn btn-quiet" data-testid="link-back-dashboard">العودة إلى لوحتي</Link>
    </div>
  </div>;
}
