import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetDashboardQueryKey, getGetSessionsQueryKey, useCreateSession, useGetDashboard, type SessionInput } from '@workspace/api-client-react';
import s from './Session.module.css';

const arabic = (value: number) => String(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
const touches = [
  { name: 'استفزاز', color: s.blue, concept: 'علاقة كثير-لواحد' },
  { name: 'كشف', color: s.purple, concept: 'قيم on_delete' },
  { name: 'استكشاف', color: s.teal, concept: 'CASCADE vs PROTECT' },
  { name: 'بناء', color: s.amber, concept: 'كتابة ForeignKey' },
  { name: 'دفاع', color: s.red, concept: 'CASCADE في المناقشة' },
];
type Mood = 'hyped' | 'normal' | 'tired';
type Result = { name: string; concept: string; passed: boolean };
const music: Record<Mood, { url: string; label: string }> = {
  hyped: { url: 'https://www.youtube.com/results?search_query=coding+music+energetic+lofi', label: 'موسيقى حماسية' },
  normal: { url: 'https://www.youtube.com/results?search_query=lofi+hip+hop+study+beats', label: 'لوفاي هادية' },
  tired: { url: 'https://www.youtube.com/results?search_query=calm+ambient+study+music', label: 'أمبيانت مريحة' },
};
const intro: Record<Mood, string> = {
  hyped: 'يلا نشتغل! اليوم منبني علاقة جدول المواعيد بمشروعك. سؤال قبل ما نبلش:',
  normal: 'اليوم منشتغل على جدول المواعيد بمشروعك. سؤال قبل ما نبلش:',
  tired: 'ما تقلق، جلسة قصيرة اليوم. منشتغل على جدول المواعيد بس. سؤال قبل ما نبلش:',
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

export default function Session() {
  const dashboard = useGetDashboard();
  const queryClient = useQueryClient();
  const create = useCreateSession();
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
  const timedOutRef = useRef(false);
  const baselineRef = useRef<number | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
  }, [touch]);
  useEffect(() => {
    if (correct) nextRef.current?.focus();
  }, [correct, phase]);
  useEffect(() => {
    if (touch > 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [touch]);

  function award(amount: number, event?: MouseEvent<HTMLElement>, big = false) {
    setEarned(value => value + amount);
    if (event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const point = { x: rect.left + rect.width / 2, y: rect.top };
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
      copy[index] = { name: touches[index].name, concept: touches[index].concept, passed };
      return copy;
    });
  }
  function answer(index: number, expected: number, explanation: string, errors: string[], event: MouseEvent<HTMLButtonElement>) {
    if (correct || wrongChoices.includes(index) || (touch === 5 && seconds === 0)) return;
    if (index !== expected) {
      miss(index, errors[index] || 'فكّر بالسبب الحقيقي.', touch === 5 ? 35 : 0);
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
        playTone('big', sound);
      },
      onError: () => { savingRef.current = false; },
    });
  }
  function next() {
    if (!correct || create.isPending) return;
    if (touch === 5 && phase === 'first') {
      setPhase('followup');
      setSeconds(30);
      timedOutRef.current = false;
      resetChoice();
    } else if (touch === 5) {
      const payload: SessionInput = { concept: 'Django ForeignKey + on_delete', touches_completed: 5, mistakes, xp_earned: 110 };
      setSavePayload(payload);
      save(payload);
    } else {
      setTouch(value => value + 1);
      resetChoice();
    }
  }
  function checkCode(event?: MouseEvent<HTMLButtonElement>) {
    if (correct) return;
    const val = code.trim().replace(/\s+/g, ' ');
    const hasFK = /ForeignKey\s*\(/.test(val);
    const hasPatient = /Patient/.test(val);
    const hasOnDelete = /on_delete\s*=/.test(val);
    const hasCascade = /CASCADE/.test(val);
    if (hasFK && hasPatient && hasOnDelete && hasCascade) {
      setCorrect(true);
      setFeedback({ ok: true, text: 'ممتاز! كتبت العلاقة صح. patient بيربط الموعد بجدول المرضى، وCASCADE يعني إذا انحذف المريض تنحذف مواعيده معه.' });
      record(3, !hint && codeTries === 0);
      award(20, event, true);
    } else {
      setCodeTries(value => value + 1);
      miss(null, `الكود ناقصه شي. ${!hasFK ? 'وين ForeignKey؟' : !hasPatient ? 'ما ذكرت اسم الجدول (Patient).' : !hasOnDelete ? 'ناقصك on_delete.' : 'شو قيمة on_delete اللي بتخلي المواعيد تنحذف مع المريض؟'}`);
    }
  }
  function restart() {
    setTouch(0); setMood('normal'); setMusicVisible(true); resetChoice();
    setMistakes(0); setEarned(0); setFloat(null); setConfetti(null);
    setCode(''); setHint(false); setCodeTries(0); setPhase('first');
    setSeconds(30); setConfidence(100); setComplete(false); setResults([]);
    setSavePayload(null); timedOutRef.current = false; savingRef.current = false;
    baselineRef.current = null; create.reset();
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

  const choices = (labels: string[], expected: number, success: string, errors: string[], verification = false) =>
    <div className={verification ? s.checkopts : s.opts}>
      {labels.map((label, index) => <button key={label} type="button" data-session-option="" data-testid={verification ? `button-verify-${label}` : `button-answer-${touch}-${phase}-${index}`}
        className={`${verification ? s.chip : s.opt} ${selected === index ? (correct ? s.right : s.wrong) : ''}`}
        disabled={correct || wrongChoices.includes(index) || (touch === 5 && seconds === 0)}
        onClick={event => answer(index, expected, success, errors, event)}>
        {!verification && <span className={s.key}>{arabic(index + 1)}</span>}<span>{label}</span>
      </button>)}
    </div>;
  const feedbackNode = feedback && <div className={`${s.fb} ${feedback.ok ? s.ok : s.no}`} role="status" data-testid="status-answer-feedback"><span className={s.fbi}>{feedback.ok ? '✓' : '!'}</span><span>{feedback.text}</span></div>;
  const nextNode = correct && <div className={s.next}><button ref={nextRef} className={`${s.btn} ${s.big}`} disabled={create.isPending} onClick={next} data-testid="button-next-touch">{touch === 5 && phase === 'followup' ? create.isPending ? 'عم نحفظ تقدمك...' : 'شوف نتيجتك' : touch === 5 ? 'السؤال الجاي ←' : 'اللمسة الجاية ←'}</button><span className={s.small}>أو اضغط Enter</span></div>;
  const readinessStart = 18;
  const readiness = readinessStart + results.reduce((sum, result) => sum + (result?.passed ? 3 : 1), 0);
  const baseXP = baselineRef.current ?? dashboard.data?.progress.total_xp ?? 0;
  const hudXP = baseXP + earned;

  return <div className={s.session}>
    {dashboard.isLoading ? <main className={s.stage} role="status" data-testid="status-loading"><div className={s.loading} style={{ width: 180, marginBottom: 24 }} /><div className={s.loading} style={{ width: '70%', height: 36, marginBottom: 30 }} /><div className={s.loading} style={{ height: 180 }} /></main>
      : dashboard.isError || !dashboard.data ? <main className={s.stage} role="alert" data-testid="status-error"><div className={s.card}><div className={s.q}>ما قدرنا نحمّل تقدّمك.</div><button className={s.btn} onClick={() => { void dashboard.refetch(); }} data-testid="button-retry-dashboard">حاول مجدداً</button></div></main>
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
              <div className={s.who}>مشرفك</div>
              <p className={s.say}>{touch === 1 ? intro[mood] : touch === 2 ? 'زبطها! هلق خليني عرّفلك اسم اللي اكتشفته:' : touch === 3 ? 'خليني جرّبك بشي بسيط قبل ما تكتب لحالك:' : touch === 4 ? 'دورك. اكتب السطر بنفسك:' : 'خلّصت! هلق دكتور من اللجنة رح يسألك:'}</p>
            </>}
            {!complete && touch === 1 && <section className={s.card}><div className={s.q}>المريض الواحد بالعيادة، كم موعد ممكن يكون إلو؟</div>
              {choices(['موعد واحد بس', 'أكتر من موعد'], 1, 'بالضبط. مريض واحد ← مواعيد كتير. هالنوع من العلاقات إلها اسم وقواعد، بنكتشفها هلق.', ['فكّر بآخر مرة زرت دكتور. رحت مرة وحدة بس، ولا أكتر؟'])}{feedbackNode}{nextNode}</section>}
            {!complete && touch === 2 && <section className={s.card}><p className={s.introtext}>هالعلاقة اسمها <code>ForeignKey</code>. أهم شي فيها كلمة <code>on_delete</code>. بتقول لـ Django شو يعمل بمواعيد المريض لو انحذف المريض.</p><p className={s.valueslabel}>في ٣ قيم بتقدر تعطيها:</p><div className={s.values}>{[['CASCADE', 'المريض راح، مواعيده تروح معه'], ['PROTECT', 'Django بيرفض حذف المريض إذا إلو مواعيد'], ['SET_NULL', 'المريض راح، مواعيده تضل بدون مريض']].map(([name, description]) => <div className={s.valuerow} key={name}><div className={s.valuename}>{name}</div><div className={s.valuedesc}>{description}</div></div>)}</div><div className={s.check}><div className={s.checkq}>قبل ما نكمّل — سؤال سريع:</div><div className={s.checkmain}>أي قيمة تحمي المريض من الحذف إذا إلو مواعيد؟</div>{choices(['CASCADE', 'PROTECT', 'SET_NULL'], 1, 'مضبوط. PROTECT معناها "احميه" — Django بيرفض الحذف إذا إلو ارتباطات.', ['CASCADE بتعمل العكس — المواعيد تنحذف مع المريض. ارجع للجدول.', '', 'SET_NULL بتفصل المواعيد عن المريض. مو حماية، لأن المريض بينحذف.'], true)}</div>{feedbackNode}{nextNode}</section>}
            {!complete && touch === 3 && <section className={s.card}><div className={s.q}>شوف نفس الكود، بس مع تعديل. شو رأيك يصير لو استخدمنا <code className={s.inlinecode}>PROTECT</code> بدل <code className={s.inlinecode}>CASCADE</code>؟</div>{choices(['بيصير نفس الشي، ما بتفرق', 'Django بيرفض يحذف المريض إذا إلو مواعيد', 'المواعيد بتنحذف والمريض بيضل'], 1, 'بالضبط. PROTECT معناها "احميه". Django بيرفض الحذف لو في مواعيد مرتبطة، عشان ما تضيع بيانات.', ['لو ما بتفرق، ليش في خيارات مختلفة؟ كل قيمة إلها معنى.', '', 'العكس. المواعيد تابعة للمريض، مش المريض تابع للمواعيد.'])}{feedbackNode}{nextNode}</section>}
            {!complete && touch === 4 && <section className={s.card}><div className={s.q}>أضف علاقة بين الموعد والمريض بحيث إذا انحذف المريض، تنحذف مواعيده معه.</div><div className={s.editor}>
              <div className={s.ln}><span className={s.n}>1</span><span className={s.c}>class Appointment(models.Model):</span></div>
              <div className={s.ln}><span className={s.n}>2</span><span className={s.c}>    date = models.DateTimeField()</span></div>
              <div className={s.ln}><span className={s.n}>3</span><span className={s.c}>    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE)</span></div>
              <div className={`${s.ln} ${s.todo}`}><span className={s.n}>4</span><span className={s.c}>    # TODO: اكتب سطر المريض هنا ↓</span></div>
              <div className={`${s.ln} ${s.inputline}`}><span className={s.n}>5</span><span className={s.c}>    patient = models.{code}{!correct && <span className={s.caret}>|</span>}</span></div>
              <div className={s.ln}><span className={s.n}>6</span><span className={s.c}>    notes = models.TextField(blank=True)</span></div>
            </div><div className={s.editoractions}><input ref={inputRef} className={s.editorinput} value={code} disabled={correct} onChange={event => setCode(event.target.value)} onPaste={event => { event.preventDefault(); setFeedback({ ok: false, text: 'اللصق مقفول. اكتبها بإيدك — هيك بتتذكرها يوم المناقشة.' }); }} onDrop={event => event.preventDefault()} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'v') { event.preventDefault(); setFeedback({ ok: false, text: 'اللصق مقفول. اكتبها بإيدك — هيك بتتذكرها يوم المناقشة.' }); } if (event.key === 'Enter') { event.preventDefault(); checkCode(); } }} placeholder="ForeignKey(Patient, on_delete=..." autoComplete="off" spellCheck={false} data-testid="input-code-answer" /><button className={s.hintbtn} disabled={hint || correct} onClick={() => { setHint(true); setConfidence(value => Math.max(0, value - 5)); }} data-testid="button-hint">تلميح <span className={s.hintcost}>−٥</span></button><button className={s.btn} disabled={correct} onClick={checkCode} data-testid="button-check-code">سلّم</button></div><div className={s.lock}>🔒 اللصق مقفول · اكتب الكود بيدك</div>{hint && <div className={s.hinttext} data-testid="status-hint">💡 ابدأ بـ <code>ForeignKey(Patient, ...</code> — شو الكلمة الثانية اللازمة بعدها؟ فكّر باللمسة الثانية.</div>}{feedbackNode}{nextNode}</section>}
            {!complete && touch === 5 && <section className={`${s.card} ${s.boss}`}><div className={s.bosshead}><div className={s.ring}><svg width="52" height="52" viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" className={s.ringbg} /><circle cx="24" cy="24" r="20" className={s.ringfg} strokeDasharray={2 * Math.PI * 20} strokeDashoffset={2 * Math.PI * 20 * (1 - seconds / 30)} /></svg><span data-testid="text-countdown">{arabic(seconds)}</span></div><div className={s.hp}><div className={s.hpl}><span>ثقتك قدام اللجنة</span><span data-testid="text-confidence">{arabic(confidence)}٪</span></div><div className={s.hpb}><i style={{ width: `${confidence}%` }} /></div></div></div><div className={s.judge}>{phase === 'first' ? 'د. سامر، عضو لجنة المناقشة:' : 'الدكتور ما اكتفى:'}</div>
              <div className={s.q}>{phase === 'first' ? 'ليش حطيت CASCADE بعلاقة المريض؟' : 'وإذا المريض إلو فواتير لازم تنحفظ حتى لو انحذف حسابه؟'}</div>
              {phase === 'first' ? choices(['لأن Django طلب مني هيك', 'لما ينحذف المريض بتنحذف مواعيده، فما بتضل يتيمة', 'ما في مشكلة، هيك أسرع'], 1, 'الدكتور هزّ راسه. جواب واثق وفيه سبب.', ['اللجنة ما بتقبل «هيك طلب مني». بدها السبب.', '', '«أسرع» مو سبب. بدو يعرف شو بيصير بالبيانات.']) : choices(['بضل على CASCADE، هي الأفضل', 'بستخدم PROTECT أو SET_NULL', 'بحذف الفواتير يدوياً قبل'], 1, 'هون عرف الدكتور إنك فاهم مش حافظ. كل حالة إلها القيمة المناسبة.', ['CASCADE بتحذف الفواتير معها. فكّر كيف تحتفظ فيها.', '', 'حذف الفواتير بيعكس المطلوب. فكّر بقيمة on_delete مناسبة.'])}
              {feedbackNode}{seconds === 0 && !correct && <button className={`${s.btn} ${s.ghost}`} style={{ marginTop: 16 }} onClick={() => { setSeconds(30); setSelected(null); setFeedback(null); timedOutRef.current = false; }} data-testid="button-retry-defense">جرّب مرة ثانية</button>}{nextNode}</section>}
            {!complete && create.isError && savePayload && <div className={s.error} role="alert" data-testid="status-save-error">خلصت التدريب، بس ما قدرنا نحفظ نتيجتك. <button className={`${s.btn} ${s.ghost}`} onClick={() => save(savePayload)} data-testid="button-retry-save">إعادة المحاولة</button></div>}
            {complete && <section className={s.end}><div className={s.endtitle}>خلّصت جلسة اليوم 🎉</div><div className={s.small}>جدول المواعيد · ForeignKey</div><div className={s.endnum}><span className={s.from}>{arabic(readinessStart)}٪</span><span className={s.arrow}>←</span><span data-testid="text-readiness">{arabic(readiness)}٪</span></div><div className={s.small}>جاهزيتك ليوم المناقشة</div><div className={s.small} style={{ marginTop: 6 }}>+{arabic(earned)} نقطة · متتاليتك: {arabic(dashboard.data.progress.streak_days)} يوم 🔥</div><ul className={s.results}>{results.map((result, i) => <li key={i} className={result.passed ? s.pass : s.soft} data-testid={`row-touch-result-${i + 1}`}><span className={s.ri}>{result.passed ? '✓' : '↺'}</span><span className={s.name}>{result.name}</span><span className={s.concept}>{result.concept}</span></li>)}</ul><button className={`${s.btn} ${s.big}`} onClick={restart} data-testid="button-new-session">ابدأ جلسة جديدة</button><Link href="/dashboard" className={s.small} style={{ marginTop: 10 }} data-testid="link-return-dashboard">ارجع للوحتي ←</Link></section>}
          </div></main>}
      </>}
  </div>;
}