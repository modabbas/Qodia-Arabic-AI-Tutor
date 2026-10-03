import { useRef, useState } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, ArrowRight, LoaderCircle, RotateCcw, Sparkles, Stethoscope, Building2, HardHat, Zap, Smile, PenLine } from 'lucide-react';
import { useGenerateAnyFieldSession, useReactToAnyFieldAnswer, type AnyFieldSession } from '@workspace/api-client-react';
import { Brand } from '../components/qodia-ui';
import { FIELDS, Options, Reorder, toOpts } from '../components/try-any-field/parts';
import '../components/try-any-field/try-any-field.css';

const ICONS = [Stethoscope, Building2, HardHat, Zap, Smile];
const NAMES = ['استفزاز', 'كشف', 'استكشاف', 'تحليل', 'دفاع'];
const OTHER = 'other';

export default function TryAnyField() {
  const [fieldId, setFieldId] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [topic, setTopic] = useState('');
  const [session, setSession] = useState<AnyFieldSession | null>(null);
  const [touch, setTouch] = useState(0);
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [text, setText] = useState('');
  const [reaction, setReaction] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [genError, setGenError] = useState(false);
  const [reactError, setReactError] = useState(false);
  const token = useRef(0);
  const gen = useGenerateAnyFieldSession({ mutation: { gcTime: 0, retry: false } });
  const react = useReactToAnyFieldAnswer({ mutation: { gcTime: 0, retry: false } });

  const fieldName = fieldId === OTHER ? custom.trim() : FIELDS.find(f => f.id === fieldId)?.name ?? '';
  const preset = FIELDS.find(f => f.id === fieldId);
  const canStart = fieldName.length >= 2 && topic.trim().length >= 2 && !gen.isPending;

  const start = () => {
    if (!canStart) return;
    const my = ++token.current;
    setGenError(false);
    gen.mutate({ data: { field: fieldName, topic: topic.trim() } }, {
      onSuccess: s => { if (my === token.current) { setSession(s); setTouch(0); setAnswered(null); } },
      onError: () => { if (my === token.current) setGenError(true); },
    });
  };
  const sendReaction = () => {
    if (!session) return;
    const my = token.current;
    setReactError(false);
    react.mutate({ data: { field: session.field, topic: session.topic, question_ar: session.touch5_defend.question_ar, explanation_ar: session.touch2_reveal.explanation_ar, answer_ar: text.trim() } }, {
      onSuccess: r => { if (my === token.current) { setReaction(r.reaction_ar); setFinished(true); } },
      onError: () => { if (my === token.current) setReactError(true); },
    });
  };
  const reset = () => {
    token.current++;
    gen.reset(); react.reset();
    setFieldId(null); setCustom(''); setTopic(''); setSession(null); setTouch(0); setAnswered(null);
    setText(''); setReaction(null); setFinished(false); setGenError(false); setReactError(false);
  };
  const next = () => { setAnswered(null); setTouch(t => t + 1); };

  const feedbackFor = (s: AnyFieldSession) => [s.touch1_challenge.feedback_ar, s.touch2_reveal.feedback_ar, s.touch3_explore.feedback_ar, s.touch4_analyze.feedback_ar][touch];
  const pct = finished ? 100 : session ? (touch / 5) * 100 + (answered !== null ? 10 : 0) : 0;

  const feedback = (s: AnyFieldSession) => answered === null ? null : <>
    <div className={`feedback ${answered ? '' : 'wrong'}`} role="status" data-testid="text-answer-feedback">
      <strong>{answered ? 'إجابة صحيحة. ' : 'ليست الأدق. '}</strong>{feedbackFor(s)}
    </div>
    <div className="taf-actions"><button type="button" className="btn btn-primary" data-testid="button-next" onClick={next}>التالي <ArrowLeft size={18} /></button></div>
  </>;

  let body;
  if (session && !finished) {
    const s = session;
    const c = touch === 0 ? s.touch1_challenge : s.touch3_explore;
    body = <section className="taf-card" key={touch} data-testid={`section-touch-${touch + 1}`}>
      {(touch === 0 || touch === 2) && <>
        <div className="taf-scenario">{c.scenario_ar}</div>
        <h2 className="taf-q">{c.question_ar}</h2>
        <Options testid={`touch${touch + 1}`} options={toOpts(c.options)} onDone={setAnswered} />
        {feedback(s)}
      </>}
      {touch === 1 && <>
        <div className="taf-scenario" data-testid="text-explanation">{s.touch2_reveal.explanation_ar}</div>
        <h2 className="taf-q">{s.touch2_reveal.question_ar}</h2>
        <Options testid="touch2" options={toOpts(s.touch2_reveal.options)} onDone={setAnswered} />
        {feedback(s)}
      </>}
      {touch === 3 && <>
        <h2 className="taf-q">{s.touch4_analyze.instruction_ar}</h2>
        {s.touch4_analyze.task_type === 'order_steps'
          ? <Reorder items={s.touch4_analyze.items} onDone={setAnswered} />
          : <Options testid="touch4" options={s.touch4_analyze.items.map(i => ({ text: i.text_ar, correct: i.correct }))} onDone={setAnswered} />}
        {feedback(s)}
      </>}
      {touch === 4 && <>
        <h2 className="taf-q" data-testid="text-defend-question">{s.touch5_defend.question_ar}</h2>
        <label className="field-label" htmlFor="taf-answer">دافع عن قرارك بكلماتك</label>
        <textarea id="taf-answer" className="field taf-area" maxLength={3000} value={text} disabled={react.isPending}
          onChange={e => setText(e.target.value)} data-testid="input-defense" placeholder="لماذا اخترت هذا، ولماذا ليس غيره؟" />
        <div className="taf-count">{text.length}/3000</div>
        {reactError && <div className="error-note" role="alert" style={{ marginTop: 12 }} data-testid="error-reaction">تعذّر الحصول على رد الآن. إجابتك محفوظة في الصفحة، جرّب مرة أخرى.</div>}
        <div className="taf-actions">
          <button type="button" className="btn btn-primary" disabled={text.trim().length < 2 || react.isPending} onClick={sendReaction} data-testid="button-send-defense">
            {react.isPending ? <><LoaderCircle className="animate-spin" size={18} /> نقرأ إجابتك...</> : reactError ? 'إعادة المحاولة' : 'أرسل دفاعك'}
          </button>
          {reactError && <button type="button" className="btn btn-outline" data-testid="button-finish-no-reaction" onClick={() => setFinished(true)}>إنهاء بدون رد</button>}
        </div>
      </>}
    </section>;
  } else if (finished) {
    body = <section className="taf-card" data-testid="section-complete">
      <p className="eyebrow">اكتملت اللمسات الخمس</p>
      <h1 className="taf-title">أنهيت التجربة في {session?.field}</h1>
      {reaction && <div className="feedback" data-testid="text-reaction">{reaction}</div>}
      <div className="taf-cta">
        <h2>هذه عيّنة قصيرة من الطريقة</h2>
        <p className="muted">في كوديا تطبّقها على مشروعك الحقيقي.</p>
        <div className="taf-actions" style={{ justifyContent: 'center' }}>
          <Link href="/signup" className="btn btn-primary" data-testid="link-signup-cta">جرّب كوديا الحقيقية لمشروع تخرجك <ArrowLeft size={18} /></Link>
          <button type="button" className="btn btn-outline" onClick={reset} data-testid="button-restart"><RotateCcw size={18} /> جرّب مجالاً آخر</button>
        </div>
      </div>
    </section>;
  } else if (gen.isPending) {
    body = <section className="taf-card" role="status" aria-live="polite" data-testid="status-generating">
      <p className="eyebrow">جارٍ التوليد</p>
      <h1 className="taf-title">نجهّز جلسة {fieldName}: {topic}</h1>
      <div className="skeleton" style={{ height: 22, width: '70%', marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 150 }} />
      <div className="taf-actions"><button type="button" className="btn btn-quiet" onClick={reset} data-testid="button-cancel"><ArrowRight size={18} /> إلغاء</button></div>
    </section>;
  } else {
    body = <section className="taf-card">
      <p className="eyebrow">اللمسات الخمس · أي مجال</p>
      <h1 className="taf-title">جرّب منهجية كوديا بأي مجال</h1>
      <p className="lesson-sub">اختر تخصصك واكتب أي مفهوم فيه، وسنولّد لك جلسة قصيرة من خمس لمسات.</p>
      <div className="taf-grid" role="group" aria-label="اختيار المجال">
        {FIELDS.map((f, i) => { const Icon = ICONS[i]; return <button key={f.id} type="button" className="taf-field" aria-pressed={fieldId === f.id} data-testid={`field-select-${f.id}`}
          onClick={() => { setFieldId(f.id); setTopic(''); }}><Icon size={24} />{f.name}</button>; })}
        <button type="button" className="taf-field" aria-pressed={fieldId === OTHER} data-testid="field-select-other" onClick={() => { setFieldId(OTHER); setTopic(''); }}><PenLine size={24} />مجال آخر (نص حر)</button>
      </div>
      {fieldId && <div className="taf-card" style={{ marginTop: 28 }}>
        {fieldId === OTHER && <div style={{ marginBottom: 18 }}>
          <label className="field-label" htmlFor="taf-custom">اسم المجال</label>
          <input id="taf-custom" className="field" maxLength={80} value={custom} onChange={e => setCustom(e.target.value)} data-testid="input-custom-field" placeholder="مثال: صيدلة، علوم بيئية..." />
        </div>}
        {preset && <><p className="field-label">اختر مثالاً أو اكتب مفهومك:</p>
          <div className="taf-chips">{preset.topics.map((t, i) => <button key={t} type="button" className="taf-chip" data-testid={`example-topic-${preset.id}-${i}`} onClick={() => setTopic(t)}>{t}</button>)}</div></>}
        <label className="field-label" htmlFor="taf-topic">المفهوم أو الموضوع</label>
        <form className="taf-row" onSubmit={e => { e.preventDefault(); start(); }}>
          <input id="taf-topic" className="field" maxLength={220} value={topic} onChange={e => setTopic(e.target.value)} data-testid="input-topic" placeholder="اكتب مفهوماً من مجالك" />
          <button type="submit" className="btn btn-primary" disabled={!canStart} data-testid="button-generate"><Sparkles size={18} /> ابدأ</button>
        </form>
        {genError && <div className="error-note" role="alert" style={{ marginTop: 14 }} data-testid="error-generate">تعذّر توليد الجلسة. مجالك وموضوعك محفوظان، أعد المحاولة. <button type="button" className="btn btn-outline" style={{ minHeight: 36, marginInlineStart: 8, padding: '6px 14px' }} onClick={start} data-testid="button-retry-generate">إعادة المحاولة</button></div>}
      </div>}
    </section>;
  }

  return <div className="taf-wrap" dir="rtl" lang="ar">
    <header className="taf-head"><Brand />{(session || fieldId) && <button type="button" className="btn btn-quiet" onClick={reset} data-testid="button-reset"><RotateCcw size={16} /> البداية</button>}</header>
    <main className="taf-main">
      <div className="taf-badge" data-testid="text-disclaimer"><AlertTriangle size={16} aria-hidden="true" />تجربة تعليمية بالذكاء الاصطناعي، وليست نصيحة طبية أو هندسية.</div>
      {session && <div style={{ marginTop: 26 }}>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label="التقدم"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
        <div className="taf-steps">{NAMES.map((n, i) => <span key={n} className={i === touch && !finished ? 'on' : ''}>{n}</span>)}</div>
      </div>}
      {body}
      <p className="taf-disc">محتوى هذه التجربة يُولَّد آلياً لأغراض العرض والتعلّم فقط، وقد يحتوي أخطاء. لا تُحفظ إجاباتك.</p>
    </main>
  </div>;
}
