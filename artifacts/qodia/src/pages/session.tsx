import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetDashboardQueryKey, getGetGeneratedSessionQueryKey, getGetProjectStructureQueryKey, getGetSessionsQueryKey, useCreateGeneratedSession, useCreateSession, useGetDashboard, useGetGeneratedSession, useGetProjectStructure, useSaveProjectFile, type GeneratedSession, type SessionInput } from '@workspace/api-client-react';
import s from './Session.module.css';

type Mood = 'hyped' | 'normal' | 'tired';
type Result = { name: string; concept: string; passed: boolean };
const touches = [
  { name: 'استفزاز', color: s.blue },
  { name: 'كشف', color: s.purple },
  { name: 'استكشاف', color: s.teal },
  { name: 'بناء', color: s.amber },
  { name: 'دفاع', color: s.red },
];
const arabic = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
const codeTokens = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b(?:import|export|from|const|let|var|function|return|class|extends|if|else|for|while|async|await|def|self|final|void|String|int|bool|true|false|null|None|new|public|private)\b|\b\d+(?:\.\d+)?\b)/g;
function highlightCode(value: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of value.matchAll(codeTokens)) {
    const index = match.index ?? last;
    if (index > last) parts.push(value.slice(last, index));
    const token = match[0];
    const kind = token.startsWith('//') || token.startsWith('#') || token.startsWith('/*') ? s.codeComment
      : /^["'`]/.test(token) ? s.codeString : /^\d/.test(token) ? s.codeNumber : s.codeKeyword;
    parts.push(<span key={index} className={kind}>{token}</span>);
    last = index + token.length;
  }
  if (last < value.length) parts.push(value.slice(last));
  return parts.length ? parts : ' ';
}
const music: Record<Mood, { url: string; label: string }> = {
  hyped: { url: 'https://www.youtube.com/results?search_query=coding+music+energetic+lofi', label: 'موسيقى حماسية' },
  normal: { url: 'https://www.youtube.com/results?search_query=lofi+hip+hop+study+beats', label: 'لوفاي هادية' },
  tired: { url: 'https://www.youtube.com/results?search_query=calm+ambient+study+music', label: 'أمبيانت مريحة' },
};

function playTone(kind: 'good' | 'bad' | 'big', enabled: boolean) {
  if (!enabled) return;
  try {
    const context = new window.AudioContext();
    const notes = kind === 'big' ? [523, 659, 784, 1047] : kind === 'bad' ? [220] : [660, 880];
    notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const time = context.currentTime + i * .08;
      oscillator.type = kind === 'bad' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, time);
      gain.gain.exponentialRampToValueAtTime(.07, time + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, time + .2);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(time);
      oscillator.stop(time + .22);
    });
    window.setTimeout(() => { void context.close(); }, 800);
  } catch { /* Audio is optional. */ }
}

function validateSession(value: unknown): GeneratedSession {
  if (!value || typeof value !== 'object') throw new Error('Invalid session response');
  const session = value as GeneratedSession;
  const validOptions = (options: unknown, index: unknown) =>
    Array.isArray(options) && options.length >= 2 && options.length <= 3 &&
    Number.isInteger(index) && (index as number) >= 0 && (index as number) < options.length &&
    options.every(option => typeof option === 'string');
  if (
    typeof session.concept_name_en !== 'string' || typeof session.concept_name_ar !== 'string' ||
    typeof session.concept_intro !== 'string' ||
    !validOptions(session.touch1_provoke?.options, session.touch1_provoke?.correct_index) ||
    !validOptions(session.touch2_reveal?.verification_options, session.touch2_reveal?.correct_index) ||
    !Array.isArray(session.touch2_reveal?.values_table) ||
    !validOptions(session.touch3_explore?.options, session.touch3_explore?.correct_index) ||
    !Array.isArray(session.touch4_build?.expected_keywords) ||
    typeof session.touch4_build?.target_file !== 'string' ||
    typeof session.touch4_build?.existing_content !== 'string' ||
    !validOptions(session.touch5_defend?.options, session.touch5_defend?.correct_index) ||
    !validOptions(session.touch5_defend?.followup_options, session.touch5_defend?.followup_correct_index)
  ) throw new Error('Invalid session response');
  return session;
}

export default function Session() {
  const dashboard = useGetDashboard();
  const generatedSession = useGetGeneratedSession({ query: { enabled: !!dashboard.data, queryKey: getGetGeneratedSessionQueryKey() } });
  const queryClient = useQueryClient();
  const create = useCreateSession();
  const saveFile = useSaveProjectFile();
  const freshSession = useCreateGeneratedSession();
  const session = generatedSession.data;
  const sessionLoading = !!dashboard.data && generatedSession.isLoading;
  const sessionError = generatedSession.isError;
  const [freshPending, setFreshPending] = useState(false);
  const [freshError, setFreshError] = useState(false);
  const [touch, setTouch] = useState(0);
  const [mood, setMood] = useState<Mood>('normal');
  const [musicVisible, setMusicVisible] = useState(true);
  const [wrongChoices, setWrongChoices] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [earned, setEarned] = useState(0);
  const [float, setFloat] = useState<{ key: number; x: number; y: number; amount: number } | null>(null);
  const [confetti, setConfetti] = useState<{ key: number; x: number; y: number } | null>(null);
  const [code, setCode] = useState('');
  const [fileSaved, setFileSaved] = useState(false);
  const [fileSaveError, setFileSaveError] = useState(false);
  const [hint, setHint] = useState(false);
  const [codeTries, setCodeTries] = useState(0);
  const [phase, setPhase] = useState<'first' | 'followup'>('first');
  const [seconds, setSeconds] = useState(30);
  const [confidence, setConfidence] = useState(100);
  const [complete, setComplete] = useState(false);
  const [sound, setSound] = useState(true);
  const [savePayload, setSavePayload] = useState<SessionInput | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const savingRef = useRef(false);
  const restoredFileRef = useRef<string | null>(null);
  const timedOutRef = useRef(false);
  const baselineRef = useRef<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const project = useGetProjectStructure({ query: { queryKey: getGetProjectStructureQueryKey(), enabled: touch === 4 && !!session } });

  useEffect(() => {
    if (touch !== 4 || !session || !project.data) return;
    const path = session.touch4_build.target_file;
    if (restoredFileRef.current === path) return;
    const draft = project.data.files.find(file => file.path === path && file.status === 'in_progress');
    if (draft?.content) setCode(current => current || draft.content || '');
    restoredFileRef.current = path;
  }, [touch, session, project.data]);

  useEffect(() => {
    if (touch !== 5 || complete || correct || seconds <= 0) return;
    const id = window.setInterval(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [touch, phase, complete, correct, seconds <= 0]);

  useEffect(() => {
    if (touch !== 5 || seconds !== 0 || correct || timedOutRef.current) return;
    timedOutRef.current = true;
    setMistakes(value => value + 1);
    setConfidence(value => Math.max(0, value - 15));
    setFeedback({ ok: false, text: 'خلص الوقت. باللجنة الحقيقية السكوت أسوأ من جواب ناقص.' });
    playTone('bad', sound);
  }, [touch, seconds, correct, sound]);

  useEffect(() => {
    if (touch !== 5 || complete || correct) return;
    const onVisibility = () => {
      if (!document.hidden) return;
      setConfidence(value => Math.max(0, value - 15));
      setMistakes(value => value + 1);
      setFeedback({ ok: false, text: 'شفتك طلعت. باللجنة ما في تبويب تاني.' });
      playTone('bad', sound);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [touch, complete, correct, sound]);

  useEffect(() => {
    if (touch === 4 && !correct) inputRef.current?.focus();
  }, [touch, correct]);
  useEffect(() => {
    if (correct) nextRef.current?.focus();
  }, [correct, phase]);
  useEffect(() => {
    if (touch > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [touch]);

  function award(amount: number, event?: MouseEvent<HTMLElement> | { x: number; y: number }, big = false) {
    setEarned(value => value + amount);
    if (event) {
      const point = 'currentTarget' in event
        ? (() => { const rect = event.currentTarget.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top }; })()
        : event;
      setFloat({ key: Date.now(), ...point, amount });
      if (big && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) setConfetti({ key: Date.now(), ...point });
    }
    playTone(big ? 'big' : 'good', sound);
  }
  function miss(index: number | null, text: string, penalty = 0) {
    if (index !== null) setWrongChoices(value => [...value, index]);
    setSelected(index);
    setMistakes(value => value + 1);
    if (penalty) setConfidence(value => Math.max(0, value - penalty));
    setFeedback({ ok: false, text });
    playTone('bad', sound);
  }
  function record(index: number, passed: boolean) {
    setResults(value => {
      const copy = [...value];
      copy[index] = {
        name: touches[index].name,
        concept: index === 0 ? session?.concept_name_ar ?? '' : index === 1 ? session?.concept_name_en ?? '' : ['استفزاز', 'كشف', 'استكشاف', 'بناء', 'دفاع'][index],
        passed,
      };
      return copy;
    });
  }
  function answer(index: number, expected: number, explanation: string, error: string, event: MouseEvent<HTMLButtonElement>) {
    if (correct || wrongChoices.includes(index) || (touch === 5 && seconds === 0)) return;
    if (index !== expected) {
      miss(index, error || 'فكّر بالسبب الحقيقي.', touch === 5 ? 35 : 0);
      return;
    }
    setSelected(index);
    setCorrect(true);
    setFeedback({ ok: true, text: explanation });
    if (touch < 5) {
      record(touch - 1, wrongChoices.length === 0);
      award(20, event, touch === 4);
    } else {
      if (phase === 'followup') record(4, wrongChoices.length === 0 && confidence >= 65);
      award(15, event, true);
    }
  }
  function resetChoice() {
    setWrongChoices([]);
    setSelected(null);
    setCorrect(false);
    setFeedback(null);
  }
  function save(payload: SessionInput) {
    if (savingRef.current) return;
    savingRef.current = true;
    create.mutate({ data: payload }, {
      onSuccess: (saved) => {
        setEarned(saved.xp_earned);
        setComplete(true);
        void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetProjectStructureQueryKey() });
        // Keep the completed lesson on screen; refetch the next planned file on navigation.
        void queryClient.invalidateQueries({ queryKey: getGetGeneratedSessionQueryKey(), refetchType: 'none' });
        playTone('big', sound);
      },
      onError: () => { savingRef.current = false; },
    });
  }
  function next() {
    if (!correct || create.isPending || !session) return;
    if (touch === 5 && phase === 'first') {
      setPhase('followup');
      setSeconds(30);
      timedOutRef.current = false;
      resetChoice();
    } else if (touch === 5) {
       const payload: SessionInput = { concept: `${session.concept_name_en} — ${session.concept_name_ar}`, concept_name_en: session.concept_name_en, touches_completed: 5, mistakes, xp_earned: 110 };
      setSavePayload(payload);
      save(payload);
    } else {
      setTouch(value => value + 1);
      resetChoice();
    }
  }
  async function checkCode(event?: MouseEvent<HTMLButtonElement>) {
    if (correct || !session || saveFile.isPending) return;
    const button = event?.currentTarget.getBoundingClientRect();
    const animationPoint = button ? { x: button.left + button.width / 2, y: button.top } : undefined;
    const value = code.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const missing = session.touch4_build.expected_keywords.filter(keyword => !value.includes(keyword.toLocaleLowerCase()));
    if (value && missing.length === 0) {
      setFileSaveError(false);
      try {
        await saveFile.mutateAsync({ data: {
          file_path: session.touch4_build.target_file,
          content: code.trim(),
          concept_name_en: session.concept_name_en,
        } });
        setFileSaved(true);
        setCorrect(true);
        setFeedback({ ok: true, text: `تم حفظ الكود في ${session.touch4_build.target_file}. ${session.touch4_build.success_message}` });
        record(3, !hint && codeTries === 0);
        award(20, animationPoint, true);
        void queryClient.invalidateQueries({ queryKey: getGetProjectStructureQueryKey() });
      } catch {
        setFileSaveError(true);
        setFeedback({ ok: false, text: 'ما قدرنا نحفظ الكود في مشروعك. حاول مرة ثانية قبل المتابعة.' });
      }
    } else {
      setCodeTries(count => count + 1);
      miss(null, `الكود ناقصه شي. ${missing.length ? `تأكد من وجود: ${missing.join('، ')}` : 'اكتب إجابتك قبل التسليم.'}`);
    }
  }
  function resetForSession() {
    setTouch(0); setMood('normal'); setMusicVisible(true); resetChoice();
    setMistakes(0); setEarned(0); setFloat(null); setConfetti(null);
    setCode(''); setHint(false); setCodeTries(0); setPhase('first');
    setFileSaved(false); setFileSaveError(false); saveFile.reset();
    setSeconds(30); setConfidence(100); setComplete(false); setResults([]);
    setSavePayload(null); timedOutRef.current = false; savingRef.current = false;
    restoredFileRef.current = null;
    baselineRef.current = null; create.reset();
  }
  async function startFresh() {
    if (freshPending) return;
    setFreshPending(true);
    setFreshError(false);
    try {
      const nextSession = validateSession(await freshSession.mutateAsync());
      queryClient.setQueryData(getGetGeneratedSessionQueryKey(), nextSession);
      resetForSession();
    } catch {
      setFreshError(true);
    } finally {
      setFreshPending(false);
    }
  }
  async function retrySession() {
    await generatedSession.refetch();
  }

  useEffect(() => {
    if (touch === 0 || complete) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, a')) return;
      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('button')) return;
      if (event.key === 'Enter' && correct) { event.preventDefault(); next(); return; }
      const number = Number(event.key);
      if (!Number.isInteger(number) || number < 1 || number > 3 || correct) return;
      const buttons = document.querySelectorAll<HTMLButtonElement>('[data-session-option]');
      const button = buttons[number - 1];
      if (button && !button.disabled) button.click();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const choices = (labels: string[], expected: number, success: string, error: string, verification = false) =>
    <div className={verification ? s.checkopts : s.opts}>
      {labels.map((label, index) => <button key={`${index}-${label}`} type="button" data-session-option="" data-testid={verification ? `button-verify-${index}` : `button-answer-${touch}-${phase}-${index}`}
        className={`${verification ? s.chip : s.opt} ${selected === index ? (correct ? s.right : s.wrong) : ''}`}
        disabled={correct || wrongChoices.includes(index) || (touch === 5 && seconds === 0)}
        onClick={event => answer(index, expected, success, error, event)}>
        {!verification && <span className={s.key}>{arabic(index + 1)}</span>}<span>{label}</span>
      </button>)}
    </div>;
  const feedbackNode = feedback && <div className={`${s.fb} ${feedback.ok ? s.ok : s.no}`} role="status" data-testid="status-answer-feedback"><span className={s.fbi}>{feedback.ok ? '✓' : '!'}</span><span>{feedback.text}</span></div>;
  const nextNode = correct && <div className={s.next}><button ref={nextRef} className={`${s.btn} ${s.big}`} disabled={create.isPending} onClick={next} data-testid="button-next-touch">{touch === 5 && phase === 'followup' ? create.isPending ? 'عم نحفظ تقدمك...' : 'شوف نتيجتك' : touch === 5 ? 'السؤال الجاي ←' : 'اللمسة الجاية ←'}</button><span className={s.small}>أو اضغط Enter</span></div>;
  const readinessStart = 18;
  const readiness = readinessStart + results.reduce((sum, result) => sum + (result?.passed ? 3 : 1), 0);
  const baseXP = baselineRef.current ?? dashboard.data?.progress.total_xp ?? 0;
  const hudXP = baseXP + earned;
  const build = session?.touch4_build;
  const defense = session?.touch5_defend;

  return <div className={s.session}>
    {dashboard.isLoading || sessionLoading ? <main className={s.stage} role="status" data-testid="status-loading" style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div aria-hidden="true" style={{ width: 38, height: 38, border: '3px solid #252525', borderTopColor: '#22c55e', borderRadius: '50%', animation: 'session-spin .8s linear infinite', marginBottom: 20 }} />
      <div style={{ fontSize: 18 }}>مشرفك يحضّر جلستك المخصصة... 🎯</div>
      <div className={s.small} style={{ marginTop: 6 }} data-testid="text-session-project">بناءً على مشروع {dashboard.data?.user.project_name || 'مشروعك'}</div>
    </main>
      : dashboard.isError || !dashboard.data ? <main className={s.stage} role="alert" data-testid="status-error"><div className={s.card}><div className={s.q}>ما قدرنا نحمّل تقدّمك.</div><button className={s.btn} onClick={() => { void dashboard.refetch(); }} data-testid="button-retry-dashboard">حاول مجدداً</button></div></main>
      : sessionError || !session ? <main className={s.stage} role="alert" data-testid="status-session-error"><div className={s.card}><div className={s.q}>ما قدرنا نحمّل جلستك. تأكد من اتصالك وحاول مرة ثانية.</div><button className={s.btn} onClick={() => { void retrySession(); }} data-testid="button-retry-session">حاول مجدداً</button></div></main>
      : <>
        {touch > 0 && <header className={s.top}>
          <Link href="/dashboard" className={s.logo} aria-label="العودة إلى اللوحة" data-testid="link-dashboard"><svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="18" fill="none" stroke="#f2f2f2" strokeWidth="4" /><path d="M19.5 16.5 L29 24 L19.5 31.5" fill="none" stroke="#f2f2f2" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>
          <div className={s.rail} data-testid="text-lesson-progress">{touches.map((item, index) => <div key={item.name} className={`${s.seg} ${index < (complete ? 5 : touch - 1) ? s.done : index === touch - 1 && !complete ? s.now : ''}`} />)}</div>
          <div className={s.meta}><span className={s.streak} data-testid="text-streak">🔥 {arabic(dashboard.data.progress.streak_days)}</span><div className={s.xpbox}><div className={s.lvl} data-testid="text-level">{arabic(Math.floor(hudXP / 100) + 1)}</div><div className={s.xpbar}><i style={{ width: `${hudXP % 100}%` }} /></div><span className={s.xpnum} data-testid="text-xp">{arabic(hudXP)}</span></div><button className={s.sound} onClick={() => setSound(value => !value)} aria-label={sound ? 'إيقاف الصوت' : 'تشغيل الصوت'} data-testid="button-toggle-sound">{sound ? <Volume2 size={16} /> : <VolumeX size={16} />}</button></div>
        </header>}
        {float && <span key={`float-${float.key}`} className={s.float} style={{ left: float.x, top: float.y }}>+{arabic(float.amount)}</span>}
        {confetti && <div key={`confetti-${confetti.key}`} className={s.bits}>{Array.from({ length: 24 }, (_, i) => <i key={i} className={s.bit} style={{ left: confetti.x, top: confetti.y, background: ['#22c55e', '#f5b84a', '#7cc7ff', '#c792ea'][i % 4], ['--dx' as string]: `${Math.cos(i * 2.4) * (60 + i * 4)}px`, ['--dy' as string]: `${Math.sin(i * 2.4) * (60 + i * 4) - 40}px` }} />)}</div>}
        {touch === 0 ? <main className={s.moodscreen}><h1>كيف حالك اليوم؟</h1><p>رح نظبّط الجلسة على مزاجك</p><div className={s.moodgrid}>{([['hyped', '🔥', 'متحمس'], ['normal', '😊', 'تمام'], ['tired', '😴', 'تعبان']] as const).map(([value, emoji, label]) => <button key={value} className={s.moodbtn} onClick={() => { baselineRef.current = dashboard.data?.progress.total_xp ?? 0; setMood(value); setTouch(1); }} data-testid={`button-mood-${label}`}><span className={s.emoji}>{emoji}</span><span>{label}</span></button>)}</div></main>
          : <main className={s.stage}><div key={complete ? 'end' : `${touch}-${phase}`} className={s.slide}>
            {!complete && <>
              {touch === 1 && musicVisible && <div className={s.music}><span className={s.note}>🎵</span><span>{music[mood].label} —</span><a href={music[mood].url} target="_blank" rel="noopener noreferrer" data-testid="link-music">افتح بلايليست</a><button className={s.x} onClick={() => setMusicVisible(false)} data-testid="button-dismiss-music">إخفاء</button></div>}
              <div className={`${s.touchlabel} ${touches[touch - 1].color}`}>اللمسة {arabic(touch)} · {touches[touch - 1].name}</div>
              <div className={s.who}>مشرفك · <span data-testid="text-session-concept">{session.concept_name_ar} ({session.concept_name_en})</span></div>
              <p className={s.say}>{touch === 1
                ? `${mood === 'hyped' ? 'يلا نشتغل! ' : mood === 'tired' ? 'ما تقلق، ' : ''}${session.concept_intro} سؤال قبل ما نبلش:`
                : touch === 2 ? 'خلينا نكشف الفكرة ونرتّب خياراتها:'
                  : touch === 3 ? 'خليني جرّبك بشي بسيط قبل ما تكتب لحالك:'
                    : touch === 4 ? 'دورك. طبّق الفكرة واكتبها بنفسك:'
                      : 'هلق دكتور من اللجنة رح يسألك:'}</p>
            </>}
            {!complete && touch === 1 && <section className={s.card}><div className={s.q}>{session.touch1_provoke.question}</div>
              {choices(session.touch1_provoke.options, session.touch1_provoke.correct_index, session.touch1_provoke.feedback_correct, session.touch1_provoke.feedback_wrong)}{feedbackNode}{nextNode}</section>}
            {!complete && touch === 2 && <section className={s.card}><p className={s.introtext}>{session.touch2_reveal.explanation}</p><p className={s.valueslabel}>خيارات ومفاهيم مرتبطة:</p><div className={s.values}>{session.touch2_reveal.values_table.map((row, index) => <div className={s.valuerow} key={`${row.code}-${index}`}><div className={s.valuename}>{row.code}</div><div className={s.valuedesc}>{row.meaning}</div></div>)}</div><div className={s.check}><div className={s.checkq}>قبل ما نكمّل — سؤال سريع:</div><div className={s.checkmain}>{session.touch2_reveal.verification_question}</div>{choices(session.touch2_reveal.verification_options, session.touch2_reveal.correct_index, session.touch2_reveal.feedback_correct, session.touch2_reveal.feedback_wrong, true)}</div>{feedbackNode}{nextNode}</section>}
            {!complete && touch === 3 && <section className={s.card}><div className={s.q}>{session.touch3_explore.question}</div>{choices(session.touch3_explore.options, session.touch3_explore.correct_index, session.touch3_explore.feedback_correct, session.touch3_explore.feedback_wrong)}{feedbackNode}{nextNode}</section>}
            {!complete && touch === 4 && build && <section className={s.card}><div className={s.q}>{build.task_description}</div>
              <p className={s.fileTarget}>اليوم رح تضيف كود لـ: <span dir="ltr">{build.target_file}</span></p>
              <p className={s.fileNote}>هذا الكود سيُحفظ في مشروعك الحقيقي. {build.integration_note}</p>
              {build.existing_content && <div className={s.priorFile}><strong>الملف الحالي (للقراءة فقط):</strong><pre dir="ltr"><code>{highlightCode(build.existing_content)}</code></pre></div>}
              <div className={s.editor}>
              {build.starter_code.split('\n').map((line, index) => <div className={s.ln} key={`${index}-${line}`}><span className={s.n}>{arabic(index + 1)}</span><span className={s.c}>{line || ' '}</span></div>)}
             </div>
              <div className={s.codeEntry}><pre className={s.syntaxMirror} aria-hidden="true"><code>{highlightCode(code)}</code></pre><textarea ref={inputRef} className={s.codeTextarea} value={code} disabled={correct || saveFile.isPending} onChange={event => setCode(event.target.value)} onScroll={event => { const mirror = event.currentTarget.previousElementSibling; if (mirror) { mirror.scrollTop = event.currentTarget.scrollTop; mirror.scrollLeft = event.currentTarget.scrollLeft; } }} onPaste={event => { event.preventDefault(); setFeedback({ ok: false, text: 'اللصق مقفول. اكتبها بإيدك — هيك بتتذكرها يوم المناقشة.' }); }} onDrop={event => event.preventDefault()} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); setFeedback({ ok: false, text: 'اللصق مقفول. اكتبها بإيدك — هيك بتتذكرها يوم المناقشة.' }); } if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void checkCode(); } }} placeholder={build.code_placeholder} autoComplete="off" spellCheck={false} data-testid="input-code-answer" aria-label={`اكتب كود الملف ${build.target_file}`} /></div>
              <div className={s.editoractions}><span className={s.small}>اكتب على أكثر من سطر. Ctrl+Enter للحفظ.</span><button className={s.hintbtn} disabled={hint || correct} onClick={() => { setHint(true); setConfidence(value => Math.max(0, value - 5)); }} data-testid="button-hint">تلميح <span className={s.hintcost}>−٥</span></button><button className={s.btn} disabled={correct || saveFile.isPending} onClick={event => { void checkCode(event); }} data-testid="button-check-code">{saveFile.isPending ? 'عم نحفظ في مشروعك...' : 'احفظ في مشروعي'}</button></div>
              <div className={s.lock}>🔒 اللصق مقفول · اكتب الكود بيدك</div>{hint && <div className={s.hinttext} data-testid="status-hint">💡 {build.hint}</div>}{feedbackNode}
              {fileSaveError && <p className={s.error} role="alert">الكود لم يُحفظ بعد. أعد المحاولة بنفس الزر.</p>}
              {fileSaved && <Link href="/my-project" className={s.projectLink} data-testid="link-view-project">شاهد مشروعك ←</Link>}{nextNode}</section>}
            {!complete && touch === 5 && defense && <section className={`${s.card} ${s.boss}`}><div className={s.bosshead}><div className={s.ring}><svg width="52" height="52" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" className={s.ringbg} /><circle cx="24" cy="24" r="20" className={s.ringfg} strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - seconds / 30)} /></svg><span data-testid="text-countdown">{arabic(seconds)}</span></div><div className={s.hp}><div className={s.hpl}><span>ثقتك قدام اللجنة</span><span data-testid="text-confidence">{arabic(confidence)}٪</span></div><div className={s.hpb}><i style={{ width: `${confidence}%` }} /></div></div></div><div className={s.judge}>{phase === 'first' ? 'عضو لجنة المناقشة:' : 'الدكتور ما اكتفى:'}</div>
              <div className={s.q}>{phase === 'first' ? defense.committee_question : defense.followup_question}</div>
              {phase === 'first'
                ? choices(defense.options, defense.correct_index, defense.explanation, defense.feedback_wrong)
                : choices(defense.followup_options, defense.followup_correct_index, defense.followup_explanation, defense.followup_feedback_wrong)}
              {feedbackNode}{seconds === 0 && !correct && <button className={`${s.btn} ${s.ghost}`} style={{ marginTop: 16 }} onClick={() => { setSeconds(30); setSelected(null); setFeedback(null); timedOutRef.current = false; }} data-testid="button-retry-defense">جرّب مرة ثانية</button>}{nextNode}</section>}
            {!complete && create.isError && savePayload && <div className={s.error} role="alert" data-testid="status-save-error">خلصت التدريب، بس ما قدرنا نحفظ نتيجتك. <button className={`${s.btn} ${s.ghost}`} onClick={() => save(savePayload)} data-testid="button-retry-save">إعادة المحاولة</button></div>}
            {complete && <section className={s.end}><div className={s.endtitle}>خلّصت جلستك 🎉</div><div className={s.small} data-testid="text-completed-concept">{session.concept_name_ar} · {session.concept_name_en}</div><div className={s.endnum}><span className={s.from}>{arabic(readinessStart)}٪</span><span className={s.arrow}>←</span><span data-testid="text-readiness">{arabic(readiness)}٪</span></div><div className={s.small}>جاهزيتك ليوم المناقشة</div><div className={s.small} style={{ marginTop: 6 }}>+{arabic(earned)} نقطة · متتاليتك: {arabic(dashboard.data.progress.streak_days)} يوم 🔥</div><ul className={s.results}>{results.map((result, i) => <li key={i} className={result.passed ? s.pass : s.soft} data-testid={`row-touch-result-${i + 1}`}><span className={s.ri}>{result.passed ? '✓' : '↺'}</span><span className={s.name}>{result.name}</span><span className={s.concept}>{result.concept}</span></li>)}</ul><Link href="/my-project" className={s.projectLink} data-testid="link-view-project">شاهد مشروعك ←</Link><button className={`${s.btn} ${s.big}`} style={{ background: 'transparent', color: '#22c55e', border: '1px solid #22c55e' }} disabled={freshPending} onClick={() => { void startFresh(); }} data-testid="button-new-session">{freshPending ? 'عم نحضّر جلستك...' : 'جلسة جديدة بمفهوم آخر ↺'}</button>{freshError && <div className={s.error} role="alert" data-testid="status-fresh-error">ما قدرنا نحمّل جلسة جديدة. تقدمك محفوظ؛ حاول مرة ثانية.</div>}{freshError && <button className={`${s.btn} ${s.ghost}`} disabled={freshPending} onClick={() => { void startFresh(); }} data-testid="button-retry-fresh">إعادة المحاولة</button>}<Link href="/dashboard" className={s.small} style={{ marginTop: 10 }} data-testid="link-return-dashboard">ارجع للوحتي ←</Link></section>}
          </div></main>}
      </>}
  </div>;
}