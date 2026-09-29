import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetDashboardQueryKey, getGetSessionsQueryKey, useCreateSession, type SessionInput } from '@workspace/api-client-react';
import { AppHeader } from '@/components/qodia-ui';

const touchInfo = [
  { name: 'استفزاز', color: '#78aaff', hint: 'قبل ما نشرح، خلّينا نشوف كيف بتفكر.' },
  { name: 'كشف', color: '#bd9aff', hint: 'شوف الفكرة كما هي، وبعدها تأكد إنك فهمتها.' },
  { name: 'استكشاف', color: '#60d7ca', hint: 'غيّر شرط واحد وشوف كيف يتغيّر القرار.' },
  { name: 'بناء', color: '#e9ba64', hint: 'هالمرة إنت اللي بتكتب السطر.' },
  { name: 'دفاع', color: '#eb7971', hint: 'تخيّل الدكتور قدامك. عندك ٣٠ ثانية.' },
];
const confettiColors = ['#22c55e', '#8dbcff', '#e7bf73', '#c699e8', '#e6e9df'];

function playTone(success: boolean, enabled: boolean) {
  if (!enabled) return;
  try {
    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(success ? 520 : 210, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(success ? 790 : 160, context.currentTime + .17);
    gain.gain.setValueAtTime(.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .24);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .25);
    oscillator.onended = () => { void context.close(); };
  } catch { /* Audio is optional when the browser blocks it. */ }
}

export default function Session() {
  const queryClient = useQueryClient();
  const create = useCreateSession();
  const [touch, setTouch] = useState(0);
  const [mood, setMood] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [correct, setCorrect] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [mistakes, setMistakes] = useState(0);
  const [xp, setXp] = useState(0);
  const [floatKey, setFloatKey] = useState(0);
  const [floatPoints, setFloatPoints] = useState(0);
  const [code, setCode] = useState('');
  const [pasted, setPasted] = useState(false);
  const [defensePhase, setDefensePhase] = useState<'first' | 'followup'>('first');
  const [seconds, setSeconds] = useState(30);
  const [complete, setComplete] = useState(false);
  const [sound, setSound] = useState(true);
  const [savePayload, setSavePayload] = useState<SessionInput | null>(null);
  const savingRef = useRef(false);
  const timedOutRef = useRef(false);

  useEffect(() => {
    if (touch !== 5 || complete || correct || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [touch, complete, correct, seconds]);
  useEffect(() => {
    if (touch === 5 && seconds === 0 && !correct && !timedOutRef.current) {
      timedOutRef.current = true;
      setMistakes(value => value + 1);
      setFeedback('خلص الوقت. ولا يهمك؛ خذ نفس وجرّب السؤال من جديد.');
      playTone(false, sound);
    }
  }, [touch, seconds, correct, sound]);

  function award(points: number) {
    setXp(value => value + points);
    setFloatPoints(points);
    setFloatKey(value => value + 1);
    playTone(true, sound);
  }
  function wrong(index: number | null, message: string) {
    setSelected(index);
    setCorrect(false);
    setMistakes(value => value + 1);
    setFeedback(message);
    playTone(false, sound);
  }
  function answer(index: number, expected: number, explanation: string, wrongMessage: string) {
    if (correct || seconds === 0 && touch === 5) return;
    setSelected(index);
    if (index !== expected) { wrong(index, wrongMessage); return; }
    setFeedback(explanation);
    if (touch === 5 && defensePhase === 'first') {
      award(15);
      setCorrect(true);
      return;
    }
    if (touch === 5 && defensePhase === 'followup') {
      award(15);
      setCorrect(true);
      return;
    }
    award(20);
    setCorrect(true);
  }
  function next() {
    if (touch === 5 && defensePhase === 'first') {
      setDefensePhase('followup');
      setSelected(null);
      setCorrect(false);
      setFeedback('');
      return;
    }
    if (touch === 5) {
      const payload = { concept: 'Django ForeignKey + on_delete', touches_completed: 5, mistakes, xp_earned: xp };
      setSavePayload(payload);
      save(payload);
      return;
    }
    setTouch(value => value + 1);
    setSelected(null);
    setCorrect(false);
    setFeedback('');
  }
  function save(payload: SessionInput) {
    if (savingRef.current) return;
    savingRef.current = true;
    create.mutate({ data: payload }, {
      onSuccess: () => {
        setComplete(true);
        void queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        void queryClient.invalidateQueries({ queryKey: getGetSessionsQueryKey() });
      },
      onError: () => { savingRef.current = false; },
    });
  }
  function checkCode() {
    if (correct) return;
    if (['ForeignKey', 'Patient', 'on_delete', 'CASCADE'].every(keyword => code.includes(keyword))) {
      setCorrect(true);
      setFeedback('ممتاز. ربطت الموعد بالمريض وحددت سلوك الحذف بوضوح.');
      award(20);
    } else wrong(null, 'راجع السطر: لازم يحتوي ForeignKey و Patient و on_delete و CASCADE.');
  }
  const readiness = Math.max(60, Math.round(100 - mistakes * 7));
  const moodPrompt = mood === '😴 تعبان'
    ? 'خذ راحتك؛ المهم تفهم الفكرة، مش تخلص بسرعة.'
    : mood === '🔥 متحمس'
      ? 'جاهز للتحدّي؟ فكّر بإجابتك وادعمها بسبب واضح.'
      : 'خطوة خطوة، وخذ وقتك قبل كل إجابة.';
  const option = (label: string, index: number, expected: number, explanation: string, wrongMessage: string) =>
    <button key={index} className={`option ${selected === index ? (correct ? 'selected' : 'incorrect') : ''}`} disabled={correct || touch === 5 && seconds === 0} onClick={() => answer(index, expected, explanation, wrongMessage)} data-testid={`button-answer-${touch}-${defensePhase}-${index}`}><span>{label}</span><span className="option-index">{String(index + 1).padStart(2, '0')}</span></button>;

  return <div className="lesson-layout">
    <AppHeader active="session" />
    {floatKey > 0 && <div key={floatKey} className="xp-float" aria-live="polite">+{floatPoints} XP</div>}
    {complete && Array.from({ length: 40 }, (_, i) => <span key={i} className="confetti-piece" style={{ left: `${(i * 37.13) % 100}%`, background: confettiColors[i % 5], animationDelay: `${(i % 8) * .13}s`, transform: `rotate(${i * 41}deg)` }} />)}
    <main className="lesson-main">
      {!complete && <><div className="lesson-topline"><span className="mono" style={{ direction: 'ltr' }}>QODIA / SESSION 01</span><div style={{ display: 'flex', alignItems: 'center', gap: 15 }}><span data-testid="text-lesson-progress">{touch === 0 ? 'قبل البداية' : `اللمسة ${touch} من ٥`}</span><button className="btn btn-quiet" style={{ minHeight: 32, padding: 4 }} onClick={() => setSound(value => !value)} aria-label={sound ? 'إيقاف الصوت' : 'تشغيل الصوت'} data-testid="button-toggle-sound">{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button></div></div><div className="progress-track" style={{ marginTop: 17 }}><div className="progress-fill" style={{ width: `${touch * 20}%` }} /></div></>}
      {touch === 0 && !complete && <section className="lesson-card"><span className="eyebrow">قبل أول سؤال</span><h1 className="lesson-title">كيف حاسس اليوم؟</h1><p className="lesson-sub">ما في جواب غلط هون. بس بدنا نعرف كيف نرافقك في الجلسة.</p><div style={{ marginTop: 40 }}>{['🔥 متحمس', '😊 تمام', '😴 تعبان'].map(label => <button key={label} className={`option ${mood === label ? 'selected' : ''}`} onClick={() => setMood(label)} data-testid={`button-mood-${label.split(' ')[1]}`}><span>{label}</span><span className="option-index">{mood === label ? <Check size={17} /> : '↗'}</span></button>)}</div>{mood && <p className="feedback" data-testid="status-mood">{mood === '😴 تعبان' ? 'على راحتك. خطوة خطوة، وما في استعجال.' : mood === '🔥 متحمس' ? 'حلو! خلّينا نشوف هالحماس قدّام أول سؤال.' : 'تمام. نبدأ بهدوء ونبني الفكرة مع بعض.'}</p>}<button className="btn btn-primary" disabled={!mood} style={{ marginTop: 26 }} onClick={() => setTouch(1)} data-testid="button-begin-lesson">يلا نبدأ <ArrowLeft size={17} /></button></section>}
      {touch > 0 && !complete && <section key={`${touch}-${defensePhase}`} className="lesson-card">
        <div className="lesson-topline"><span style={{ color: touchInfo[touch - 1].color, fontWeight: 700 }}>0{touch} / {touchInfo[touch - 1].name}</span><span className="mono" style={{ color: '#22c55e' }}>{xp} XP</span></div>
        <p className="lesson-sub" style={{ fontSize: 13, marginTop: 15 }}>{touchInfo[touch - 1].hint} {moodPrompt}</p>
        {touch === 1 && <><h1 className="lesson-title">المريض الواحد بالعيادة، كم موعد ممكن يكون إلو؟</h1><div style={{ marginTop: 35 }}>{option('موعد واحد بس', 0, 1, 'بالضبط. مريض واحد ممكن يكون إله مواعيد كتير؛ هون بتبدأ علاقة واحد إلى متعدد.', 'تخيّل المريض رجع للعيادة الأسبوع الجاي. هل لازم يكون إله سجل موعد جديد؟')}{option('أكتر من موعد', 1, 1, 'بالضبط. مريض واحد ممكن يكون إله مواعيد كتير؛ هون بتبدأ علاقة واحد إلى متعدد.', 'فكر بالعلاقة بين المريض ومواعيده.')}</div></>}
        {touch === 2 && <><h1 className="lesson-title">العلاقة في الكود اسمها <span className="mono" style={{ color: '#bd9aff' }}>ForeignKey.</span></h1><p className="lesson-sub">كل موعد يشير لمريض واحد، والمريض ممكن يرتبط بمواعيد كثيرة. في Django، خيار <span className="mono">on_delete</span> يحدد شو بيصير بالمواعيد لما نحاول نحذف المريض.</p><div className="panel" style={{ padding: '6px 19px', marginTop: 25 }}><table className="teach-table"><tbody><tr><td>CASCADE</td><td>احذف مواعيد المريض معه.</td></tr><tr><td>PROTECT</td><td>امنع حذف المريض إذا عنده مواعيد.</td></tr><tr><td>SET_NULL</td><td>خلّي المواعيد بدون مريض، إذا الحقل يقبل null.</td></tr></tbody></table></div><h2 style={{ fontSize: 22, margin: '35px 0 15px' }}>أي قيمة تحمي المريض من الحذف إذا إلو مواعيد؟</h2><div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>{['CASCADE', 'PROTECT', 'SET_NULL'].map((label, i) => <button key={label} className={`btn ${selected === i && correct ? 'btn-primary' : 'btn-outline'}`} disabled={correct} onClick={() => answer(i, 1, 'صح. PROTECT يرفض الحذف ما دام في مواعيد مرتبطة بالمريض.', 'مش هي. دور على الخيار اللي يمنع الحذف بدل ما يحذف أو يفصل العلاقة.')} data-testid={`button-verify-${label}`}>{label}</button>)}</div></>}
        {touch === 3 && <><h1 className="lesson-title">بدّل القرار: شو بيصير لو استخدمنا <span className="mono" style={{ color: '#60d7ca' }}>PROTECT</span> بدل <span className="mono">CASCADE</span>؟</h1><div style={{ marginTop: 35 }}>{['Django بيحذف المريض وكل مواعيده', 'Django بيرفض يحذف المريض إذا إلو مواعيد', 'Django بيترك المواعيد بدون مريض'].map((label, i) => option(label, i, 1, 'بالضبط. PROTECT يحافظ على بيانات المواعيد ويمنع حذف المريض المرتبط فيها.', 'ارجع للجدول: PROTECT يمنع الحذف، بينما CASCADE يحذف المرتبط معه.'))}</div></>}
        {touch === 4 && <><h1 className="lesson-title">هلق دورك تكتب العلاقة.</h1><p className="lesson-sub">كمّل سطر الربط بين الموعد والمريض باستخدام <span className="mono">CASCADE</span>. اكتبه بإيدك؛ اللصق مقفول هون.</p><div className="code-block" style={{ margin: '29px 0 18px' }}><div style={{ color: '#798b7d' }}># models.py</div><div>class Appointment(models.Model):</div><div style={{ color: '#e9ba64' }}>&nbsp;&nbsp;# TODO: link appointment to a patient</div></div><label htmlFor="code" className="field-label">السطر الناقص</label><input id="code" className="field code-input" value={code} onChange={e => { setCode(e.target.value); setPasted(false); }} onPaste={e => { e.preventDefault(); setPasted(true); }} onDrop={e => e.preventDefault()} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); setPasted(true); } }} autoComplete="off" autoCorrect="off" spellCheck={false} placeholder="patient = models.ForeignKey(...)" data-testid="input-code-answer" />{pasted && <p style={{ color: '#e9ba64', fontSize: 13 }} role="status" data-testid="status-paste-blocked">النسخ واللصق مقفول. اكتب السطر بنفسك عشان يثبت.</p>}<button className="btn btn-outline" style={{ marginTop: 17 }} disabled={correct || !code.trim()} onClick={checkCode} data-testid="button-check-code">تحقق من السطر <Check size={16} /></button></>}
        {touch === 5 && <><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: 28, gap: 20, flexWrap: 'wrap' }}><div><span className="eyebrow" style={{ color: '#eb7971' }}>محاكاة المناقشة</span><h1 className="lesson-title" style={{ marginBottom: 0 }}>{defensePhase === 'first' ? 'ليش حطيت CASCADE بعلاقة المريض؟' : 'وإذا؟'}</h1></div><div style={{ textAlign: 'left' }}><span className="muted" style={{ fontSize: 12, display: 'flex', gap: 6, justifyContent: 'end' }}><Clock3 size={14} /> الوقت المتبقي</span><div className={`timer ${seconds <= 10 ? 'urgent' : ''}`} data-testid="text-countdown">{String(seconds).padStart(2, '0')}<span style={{ fontSize: 20, marginLeft: 7 }}>s</span></div></div></div><p className="lesson-sub">{defensePhase === 'first' ? 'الدكتور بيسألك عن سبب قرارك. اختر الإجابة اللي تقدر تدافع عنها.' : 'الدكتور يسأل: وإذا كان لازم نحتفظ بالمواعيد حتى بعد حذف المريض، شو بتختار بدل CASCADE؟'}</p><div style={{ marginTop: 28 }}>{defensePhase === 'first' ? ['لأنه أسهل خيار وخلاص', 'لأنه حذف المريض لازم يحذف مواعيده المرتبطة معه بهذا التصميم', 'لأنه بيمنع حذف المريض إذا عنده مواعيد'].map((label, i) => option(label, i, 1, 'إجابة مدعومة بقرار تصميم: لو حذفنا المريض، مواعيده لم تعد منطقية في هذا النظام.', 'مو كفاية تقول إنه أسهل. اربط اختيارك بسلوك البيانات عند حذف المريض.')) : ['أستخدم PROTECT عشان أمنع الحذف تماماً', 'أستخدم SET_NULL مع null=True حتى تبقى المواعيد بدون مريض', 'أترك CASCADE لأنه بيحتفظ بالمواعيد'].map((label, i) => option(label, i, 1, 'ممتاز. SET_NULL يبقي المواعيد، بشرط إن العلاقة تقبل null. هيك بتدافع عن البديل كمان.', 'لو بدك تحذف المريض وتحتفظ بالمواعيد، فكّر بخيار يفصل العلاقة بدون حذف السجلات.'))}</div>{seconds === 0 && !correct && <button className="btn btn-outline" onClick={() => { setSeconds(30); setSelected(null); setFeedback(''); timedOutRef.current = false; }} data-testid="button-retry-defense"><RotateCcw size={16} /> جرّب مرة ثانية</button>}</>}
        {feedback && <div className={`feedback ${correct ? '' : 'wrong'}`} role="status" data-testid="status-answer-feedback">{correct ? 'صحيح. ' : 'خلّينا نعيد التفكير. '}{feedback}</div>}
        {correct && <button className="btn btn-primary" style={{ marginTop: 27 }} disabled={create.isPending} onClick={next} data-testid="button-next-touch">{touch === 5 ? defensePhase === 'first' ? 'سؤال الدكتور التالي' : create.isPending ? 'عم نحفظ تقدمك...' : 'شوف جاهزيتك' : 'اللمسة التالية'} <ArrowLeft size={17} /></button>}
        {create.isError && savePayload && <div className="error-note" role="alert" style={{ marginTop: 22 }} data-testid="status-save-error">خلصت التدريب، بس ما قدرنا نحفظ نتيجتك. <button onClick={() => save(savePayload)} className="btn btn-outline" style={{ margin: '10px 0 0', display: 'flex' }} data-testid="button-retry-save">إعادة المحاولة</button></div>}
      </section>}
      {complete && <section className="lesson-card" style={{ textAlign: 'center', paddingTop: 35 }}><span className="eyebrow">أنهيت اللمسات الخمس</span><h1 className="lesson-title" style={{ marginTop: 20 }}>وقفت ودافعت.<br /><span style={{ color: '#22c55e' }}>وهذا هو الفرق.</span></h1><div className="panel" style={{ maxWidth: 520, margin: '35px auto', padding: '35px 22px', borderColor: '#366a43' }}><p className="muted" style={{ margin: 0 }}>جاهزيتك ليوم المناقشة:</p><div className="mono" style={{ color: '#22c55e', fontSize: 'clamp(65px, 12vw, 110px)', lineHeight: 1.3 }} data-testid="text-readiness">{readiness}%</div><p className="muted" style={{ margin: 0 }}>كل محاولة بتقربك من جواب أوثق.</p><div style={{ borderTop: '1px solid #324535', marginTop: 24, paddingTop: 20, display: 'flex', justifyContent: 'space-around', fontSize: 14 }}><span>٥ / ٥ لمسات</span><span className="mono" style={{ color: '#22c55e' }}>+{xp} XP</span><span>{mistakes} أخطاء</span></div></div><div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}><Link href="/dashboard" className="btn btn-primary" data-testid="link-return-dashboard">ارجع للوحتي <ArrowLeft size={17} /></Link><button className="btn btn-outline" onClick={() => { setTouch(0); setMood(''); setSelected(null); setCorrect(false); setFeedback(''); setMistakes(0); setXp(0); setFloatKey(0); setCode(''); setDefensePhase('first'); setSeconds(30); setComplete(false); setSavePayload(null); timedOutRef.current = false; savingRef.current = false; create.reset(); }} data-testid="button-new-session"><ArrowRight size={16} /> تدرب مرة ثانية</button></div></section>}
    </main>
  </div>;
}