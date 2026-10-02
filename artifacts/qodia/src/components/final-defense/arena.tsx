import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LoaderCircle, LogOut, RotateCcw, Send } from 'lucide-react';
import {
  getGetDefenseQueryKey, getGetDefenseSummaryQueryKey, useAbandonDefense, useAdvanceDefense, useCompleteDefense,
  useGetDefense, useSaveDefenseDraft, useSubmitDefenseAnswer, type DefenseSimulation,
} from '@workspace/api-client-react';
import { ErrorState, LoadingState } from '@/components/qodia-ui';
import { PROFESSORS, ProfessorPanel, professorKey } from './professors';
import { Disclaimer, Verdict, ar } from './verdict';

const DIFF: Record<string, string> = { basic: 'أساسي', intermediate: 'متوسط', advanced: 'متقدم' };
const MAX_POLLS = 20;

export function Arena({ simId, userId, onLeave, onNew }: { simId: string; userId: string; onLeave: () => void; onNew: () => void }) {
  const qc = useQueryClient();
  const key = getGetDefenseQueryKey(simId);
  const detail = useGetDefense(simId, { query: { queryKey: key, staleTime: 0, refetchOnMount: 'always' } });
  const sim = detail.data;
  const saveM = useSaveDefenseDraft(); const submitM = useSubmitDefenseAnswer(); const advanceM = useAdvanceDefense();
  const completeM = useCompleteDefense(); const abandonM = useAbandonDefense();
  const saveRef = useRef(saveM.mutateAsync); saveRef.current = saveM.mutateAsync;
  const submitRef = useRef(submitM.mutateAsync); submitRef.current = submitM.mutateAsync;
  const refetchRef = useRef(detail.refetch); refetchRef.current = detail.refetch;

  const q = sim ? sim.questions[Math.min(sim.current_index, 4)] : undefined;
  const qRef = useRef(q); qRef.current = q;
  const offset = useMemo(() => (sim ? Date.parse(sim.server_now) - detail.dataUpdatedAt : 0), [sim?.server_now, detail.dataUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const [, setTick] = useState(0);
  const live = sim?.status === 'active';
  useEffect(() => { if (!live) return; const t = setInterval(() => setTick(n => n + 1), 250); return () => clearInterval(t); }, [live]);
  const nowMs = Date.now() + offset;
  const startedMs = sim?.current_question_started_at ? Date.parse(sim.current_question_started_at) : 0;
  const deadlineMs = sim?.deadline_at ? Date.parse(sim.deadline_at) : 0;
  const unanswered = !!q && q.student_answer === null && q.evaluation_status === 'unanswered';
  const started = startedMs <= nowMs;
  const secs = unanswered && started && deadlineMs ? Math.max(0, Math.min(60, Math.ceil((deadlineMs - nowMs) / 1000))) : 60;
  const intro = !!sim && live && sim.current_index === 0 && unanswered && !started && q?.draft === '';

  const patch = useCallback((s: DefenseSimulation) => { qc.setQueryData(key, s); void qc.invalidateQueries({ queryKey: getGetDefenseSummaryQueryKey() }); }, [qc, key]);
  const patchRef = useRef(patch); patchRef.current = patch;

  // ---- drafts
  const sk = (n: number) => `qodia-defense:${userId}:${simId}:${n}`;
  const [text, setText] = useState('');
  const textRef = useRef(''); const lastSaved = useRef(''); const initKey = useRef(''); const timer = useRef<number | undefined>(undefined);
  const [draftWarn, setDraftWarn] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const inflight = useRef<Promise<boolean> | null>(null);
  const flush = useCallback((force = false): Promise<boolean> => {
    window.clearTimeout(timer.current);
    if (inflight.current) return inflight.current.then(() => (textRef.current === lastSaved.current ? true : flushRef.current(force)));
    const run = async (): Promise<boolean> => {
      setSaving(true);
      try {
        while (true) {
          const cur = qRef.current; const v = textRef.current;
          if (!cur || v === lastSaved.current) return true;
          if (!force && lockRef.current === `${simId}:${cur.question_number}`) return true;
          const num = cur.question_number;
          let s: DefenseSimulation;
          try { s = await saveRef.current({ id: simId, data: { question_number: num, draft: v } }); }
          catch { setDraftWarn('تعذّر حفظ مسودتك على الخادم. نسخة منها محفوظة على جهازك، وسنحاول مرة أخرى مع كتابتك التالية.'); return false; }
          lastSaved.current = v; setDraftWarn(null);
          const existing = qc.getQueryData<DefenseSimulation>(key);
          const eq = existing?.questions.find(x => x.question_number === num);
          if (existing && eq && eq.student_answer === null && eq.evaluation_status === 'unanswered' && existing.status === 'active') qc.setQueryData(key, s);
        }
      } finally { setSaving(false); inflight.current = null; }
    };
    // Assign before run can finish: a no-op save otherwise clears the ref
    // synchronously, then leaves an already-resolved promise stuck in it.
    inflight.current = Promise.resolve().then(run);
    return inflight.current;
  }, [simId, qc, key]);
  const flushRef = useRef(flush); flushRef.current = flush;
  const schedule = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => { void flushRef.current(false); }, 600); };

  useEffect(() => {
    if (!q || !unanswered) return;
    const ik = `${simId}:${q.question_number}`;
    if (initKey.current === ik) return;
    initKey.current = ik;
    let local: string | null = null;
    try { local = sessionStorage.getItem(sk(q.question_number)); } catch { local = null; }
    const useLocal = !!local && local !== q.draft;
    const start = useLocal ? local! : q.draft;
    setText(start); textRef.current = start; lastSaved.current = q.draft;
    setDraftWarn(useLocal ? 'استرجعنا نسخة محلية من مسودتك لم تُحفظ على الخادم بعد، وسنحفظها الآن.' : null);
    if (useLocal) schedule();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = () => { if (document.visibilityState === 'hidden') void flushRef.current(false); };
    document.addEventListener('visibilitychange', h);
    return () => { document.removeEventListener('visibilitychange', h); window.clearTimeout(timer.current); };
  }, []);

  const onType = (v: string) => {
    if (locked) return;
    setText(v); textRef.current = v;
    try { if (q) sessionStorage.setItem(sk(q.question_number), v); } catch { /* storage unavailable */ }
    schedule();
  };

  // ---- submit with lock
  const lockRef = useRef(''); const [locked, setLocked] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);
  const polls = useRef(0); const [pollsDone, setPollsDone] = useState(false);
  const qn = q?.question_number;
  useEffect(() => { setLocked(false); setSubmitError(null); setLateNotice(null); polls.current = 0; setPollsDone(false); }, [qn, simId]);

  const [lateNotice, setLateNotice] = useState<string | null>(null);
  const lockedRef = useRef(false); lockedRef.current = locked;
  const doSubmit = useCallback(async (auto = false) => {
    const cur = qRef.current; if (!cur) return;
    const lk = `${simId}:${cur.question_number}`;
    if (lockRef.current === lk) return;
    lockRef.current = lk; setLocked(true); setSubmitError(null);
    const answer = textRef.current; // captured at lock time
    if (auto) {
      if (answer !== lastSaved.current) setLateNotice('انتهى الوقت. تعتمد اللجنة آخر مسودة محفوظة على الخادم فقط، وقد لا تشمل كل ما كتبته بعد آخر حفظ. نسختك المحلية محفوظة أدناه.');
      void flushRef.current(true);
    } else await flushRef.current(true);
    try {
      const s = await submitRef.current({ data: { simulation_id: simId, question_number: cur.question_number, answer: auto ? answer : textRef.current } });
      patchRef.current(s);
      if (!auto) { try { sessionStorage.removeItem(`qodia-defense:${userId}:${simId}:${cur.question_number}`); } catch { /* ignore */ } }
    } catch {
      lockRef.current = ''; setLocked(false);
      setSubmitError(auto ? 'تعذّر إرسال إجابتك بسبب الاتصال بعد انتهاء الوقت. قد تُقيَّم آخر مسودة محفوظة على الخادم فقط وليس كل نصك المحلي، ولا نضمن أن النص غير المرسل سيُحتسب.' : 'تعذّر إرسال إجابتك بسبب الاتصال. مسودتك محفوظة، أعد الإرسال عند عودة الاتصال.');
      void refetchRef.current();
    }
  }, [simId, userId]);
  const doSubmitRef = useRef(doSubmit); doSubmitRef.current = doSubmit;

  const expired = unanswered && started && !!deadlineMs && nowMs >= deadlineMs;
  useEffect(() => { if (expired && live) void doSubmitRef.current(true); }, [expired, live, qn]);
  const editable = unanswered && started && !expired && !locked;

  // ---- evaluation retry + polling
  const status = q?.evaluation_status;
  useEffect(() => {
    if (status !== 'pending' || !live) return;
    if (polls.current >= MAX_POLLS) { setPollsDone(true); return; }
    const t = window.setTimeout(() => { polls.current += 1; void refetchRef.current().then(() => { if (polls.current >= MAX_POLLS) setPollsDone(true); }); }, 2500);
    return () => window.clearTimeout(t);
  }, [status, live, qn, detail.dataUpdatedAt]);

  const retryEval = async () => {
    if (!q || q.student_answer === null) return;
    setRetryBusy(true); setSubmitError(null);
    try { const s = await submitRef.current({ data: { simulation_id: simId, question_number: q.question_number, answer: q.student_answer } }); patch(s); polls.current = 0; setPollsDone(false); }
    catch { setSubmitError('لم يكتمل التقييم بعد. إجابتك محفوظة كما هي؛ حاول مرة أخرى بعد قليل.'); }
    finally { setRetryBusy(false); }
  };

  const [confirmQuit, setConfirmQuit] = useState(false);
  const quit = () => { abandonM.mutate({ id: simId }, { onSuccess: s => { qc.setQueryData(key, s); void qc.invalidateQueries({ queryKey: getGetDefenseSummaryQueryKey() }); onLeave(); } }); };
  const advance = () => { advanceM.mutate({ id: simId }, { onSuccess: patch }); };
  const complete = useCallback(() => { completeM.mutate({ data: { simulation_id: simId } }, { onSuccess: patch }); }, [completeM, simId, patch]);

  if (detail.isLoading) return <LoadingState label="نستعيد حالة المحاكاة من الخادم..." />;
  if (detail.isError || !sim || !q) return <ErrorState retry={() => { void detail.refetch(); }} text="تعذّر استعادة المحاكاة. لم يضع شيء، فالإجابات والمؤقت محفوظان على الخادم." />;
  if (sim.status === 'completed') return <Verdict sim={sim} onNew={onNew} />;
  if (sim.status === 'abandoned') return <div className="fd-center">
    <h1>أُنهيت هذه المحاكاة</h1>
    <p className="fd-sub">النتائج الجزئية محفوظة: {ar(sim.answered_count)} من ٥ إجابات. لا تُحتسب درجة نهائية لمحاكاة غير مكتملة.</p>
    <div style={{ width: 'min(720px,100%)', textAlign: 'right' }} data-testid="section-partial-results">
      {sim.questions.filter(answer => answer.student_answer !== null).map(answer => <article className="fd-detail" key={answer.question_number}>
        <strong>السؤال {ar(answer.question_number)} — {answer.professor}</strong>
        <p>{answer.question_text}</p>
        <p><strong>إجابتك المحفوظة:</strong> {answer.student_answer?.trim() || 'لم تُكتب إجابة.'}</p>
        <p><strong>الدرجة:</strong> {answer.points === null ? 'التقييم غير مكتمل' : `${ar(answer.points)} / ١٠٠`}</p>
        {answer.mini_feedback && <p>{answer.mini_feedback}</p>}
      </article>)}
    </div>
    <div className="fd-actions"><button className="btn btn-primary" onClick={onNew} data-testid="button-new-simulation">محاكاة جديدة</button><button className="btn btn-outline" onClick={onLeave} data-testid="button-back-entry">رجوع</button></div>
  </div>;

  const who = professorKey(q.professor);
  const accent = PROFESSORS[who].from;

  if (intro) {
    const ms = startedMs - nowMs;
    if (ms > 1000) return <div className="fd-center" data-testid="section-countdown" role="status"><p className="fd-sub">{q.professor} سيبدأ المناقشة في...</p><div className="fd-count" aria-label={`${Math.ceil((ms - 1000) / 1000)}`}>{ar(Math.max(1, Math.ceil((ms - 1000) / 1000)))}</div></div>;
    return <div className="fd-center" data-testid="section-reveal"><p className="fd-sub">لجنة المناقشة الافتراضية</p><div style={{ width: 'min(720px,100%)' }}><ProfessorPanel reveal /></div></div>;
  }

  const last = q.question_number === 5;
  const allScored = sim.questions.every(x => x.evaluation_status === 'scored');
  const tone = secs >= 30 ? 'ok' : secs >= 15 ? 'warn' : 'danger';
  const toneLabel = tone === 'ok' ? 'الوقت مريح' : tone === 'warn' ? 'الوقت يضيق' : 'الوقت حرج';

  return <div className="fd-run" style={{ ['--pc' as string]: accent }} data-testid="section-arena">
    <div className="fd-qhead"><div className="fd-progress" style={{ flex: 1, minWidth: 160 }} aria-label={`السؤال ${ar(q.question_number)} من ٥`}>{sim.questions.map(x => <span key={x.question_number} className={`fd-seg${x.evaluation_status === 'scored' ? ' done' : x.question_number === q.question_number ? ' now' : ''}`} />)}</div>
      <button className="btn btn-quiet" style={{ minHeight: 38 }} onClick={() => setConfirmQuit(true)} data-testid="button-quit"><LogOut size={16} /> إنهاء المحاكاة</button></div>
    <ProfessorPanel active={who} compact />
    {sim.source === 'curated' && <Disclaimer source="curated" />}
    <section className="fd-question" aria-labelledby="fd-q">
      <div className="fd-qhead"><span className="eyebrow">السؤال {ar(q.question_number)} من ٥ — {q.professor} ({q.role})</span><div className="fd-meta"><span className="fd-chip">{DIFF[q.difficulty] ?? q.difficulty}</span><span className="fd-chip">{q.concept_tested}</span><span className="fd-chip mono">{q.file_reference}</span></div></div>
      <h2 id="fd-q" data-testid="text-question">{q.question_text}</h2>
    </section>

    {unanswered && <>
      <div className="fd-timer" role="timer" aria-label="الوقت المتبقي"><span className={`fd-time-num ${tone}`} data-testid="text-timer">{started ? ar(secs) : ar(60)}</span><div className={`fd-bar ${tone}`}><div style={{ transform: `scaleX(${secs / 60})` }} /></div><span className="fd-status">ثانية — {toneLabel}</span></div>
      <span className="sr-only" aria-live="polite">{[30, 15, 0].includes(secs) && started ? (secs === 0 ? 'انتهى الوقت' : `${secs} ثانية متبقية، ${toneLabel}`) : ''}</span>
      <textarea className="fd-textarea" value={text} onChange={e => onType(e.target.value)} disabled={!editable} maxLength={12000} placeholder={started ? 'اكتب إجابتك هنا...' : 'تستعد اللجنة للسؤال...'} aria-label="إجابتك" data-testid="input-answer" />
      {draftWarn && <p className="fd-warn" role="alert" data-testid="text-draft-warning">{draftWarn}</p>}
      {submitError && <p className="fd-error" role="alert" data-testid="text-submit-error">{submitError}</p>}
      {expired && !submitError && <p className="fd-warn">انتهى الوقت. تُرسل آخر مسودة محفوظة تلقائياً.</p>}
      <div className="fd-foot"><span className="fd-status">{saving ? 'نحفظ المسودة...' : `${ar(text.length)} / ${ar(12000)}`} — لا تلميحات ولا إعادة</span>
        <button className="btn btn-primary" disabled={!editable && !submitError} onClick={() => { void doSubmit(false); }} data-testid="button-submit-answer">{locked ? <LoaderCircle size={17} className="animate-spin" /> : <Send size={17} />} {submitError ? 'أعد الإرسال' : 'إرسال الإجابة'}</button></div>
    </>}

    {!unanswered && lateNotice && <div className="fd-warn" data-testid="text-late-notice"><p style={{ margin: 0 }}>{lateNotice}</p><pre className="fd-local-copy" dir="auto">{textRef.current}</pre></div>}
    {!unanswered && q.evaluation_status === 'pending' && <div className="fd-question" role="status" data-testid="status-evaluating">
      <div className="fd-skel"><div className="skeleton" style={{ height: 14, width: '40%' }} /><div className="skeleton" style={{ height: 14, width: '80%' }} /><div className="skeleton" style={{ height: 14, width: '65%' }} /></div>
      <p className="fd-sub" style={{ marginTop: 14 }}>اللجنة تقيّم إجابتك الآن. المؤقت متوقف.</p>
      {pollsDone && <><p className="fd-warn">التقييم يتأخر. إجابتك مقفلة ومحفوظة على الخادم.</p>{submitError && <p className="fd-error" role="alert">{submitError}</p>}<div className="fd-actions"><button className="btn btn-outline" onClick={() => { polls.current = 0; setPollsDone(false); void detail.refetch(); }} data-testid="button-recheck">تحقق مجدداً</button><button className="btn btn-primary" onClick={() => { void retryEval(); }} disabled={retryBusy} data-testid="button-retry-evaluation"><RotateCcw size={16} /> إعادة التقييم</button></div></>}
    </div>}

    {!unanswered && q.evaluation_status === 'failed' && <div className="fd-question" role="alert" data-testid="status-eval-failed">
      <p className="fd-error">تعذّر تقييم إجابتك الآن بسبب خلل في خدمة التقييم. إجابتك محفوظة كما كتبتها، ولا درجة مسجّلة حتى يكتمل التقييم.</p>
      {submitError && <p className="fd-error">{submitError}</p>}
      <div className="fd-actions"><button className="btn btn-primary" onClick={() => { void retryEval(); }} disabled={retryBusy} data-testid="button-retry-evaluation">{retryBusy ? <LoaderCircle size={16} className="animate-spin" /> : <RotateCcw size={16} />} إعادة التقييم</button></div>
    </div>}

    {q.evaluation_status === 'scored' && <div className="fd-question" data-testid="section-reaction">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><span className="eyebrow">رد {q.professor}</span><div style={{ textAlign: 'left' }}><div className="fd-score" data-testid="text-points">{q.points === null ? '—' : ar(q.points)}</div><span className="fd-status">من ١٠٠ — تقدير تدريبي</span></div></div>
      <p className="fd-reaction">{q.professor_reaction ?? q.mini_feedback}</p>
      {q.professor_reaction && q.mini_feedback && <p className="fd-sub" style={{ fontSize: 15 }}>{q.mini_feedback}</p>}
      <div className="fd-two"><div className="fd-list good"><h4>نقاط القوة</h4><ul>{q.strengths.length ? q.strengths.map((s, i) => <li key={i}>{s}</li>) : <li>لا شيء مسجّل</li>}</ul></div><div className="fd-list bad"><h4>نقاط الضعف</h4><ul>{q.weaknesses.length ? q.weaknesses.map((s, i) => <li key={i}>{s}</li>) : <li>لا شيء مسجّل</li>}</ul></div></div>
      {(advanceM.isError || completeM.isError) && <p className="fd-error" role="alert" data-testid="text-advance-error">تعذّر المتابعة. حاول مرة ثانية.</p>}
      <div className="fd-actions" style={{ justifyContent: 'flex-start', marginTop: 18 }}>
        {last && allScored
          ? <button className="btn btn-primary" onClick={complete} disabled={completeM.isPending} data-testid="button-complete">{completeM.isPending ? <><LoaderCircle size={17} className="animate-spin" /> نجمع قرار اللجنة...</> : completeM.isError ? <><RotateCcw size={17} /> أعد المحاولة</> : <>عرض قرار اللجنة <ArrowLeft size={17} /></>}</button>
          : <button className="btn btn-primary" onClick={advance} disabled={advanceM.isPending} data-testid="button-next-question">{advanceM.isPending ? <LoaderCircle size={17} className="animate-spin" /> : null} السؤال التالي <ArrowLeft size={17} /></button>}
      </div>
    </div>}
    <Disclaimer source="gemini" />

    {confirmQuit && <div className="fd-modal" role="dialog" aria-modal="true" aria-labelledby="fd-quit-t"><div className="fd-card"><h2 id="fd-quit-t" style={{ margin: '0 0 8px', fontSize: 24 }}>إنهاء المحاكاة؟</h2><p className="fd-sub" style={{ fontSize: 15 }}>ستُحفظ إجاباتك السابقة كنتيجة جزئية، ولا يمكن إكمال هذه المحاكاة بعد الإنهاء.</p>{abandonM.isError && <p className="fd-error" role="alert">تعذّر الإنهاء، حاول مجدداً.</p>}<div className="fd-actions" style={{ justifyContent: 'flex-start' }}><button className="btn btn-outline" onClick={() => setConfirmQuit(false)} data-testid="button-cancel-quit">متابعة المناقشة</button><button className="btn fd-btn-danger" onClick={quit} disabled={abandonM.isPending} data-testid="button-confirm-quit">{abandonM.isPending ? 'جارٍ الإنهاء...' : 'إنهاء وحفظ الجزئي'}</button></div></div></div>}
  </div>;
}
