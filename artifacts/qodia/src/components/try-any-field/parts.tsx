import { useState } from 'react';
import { ArrowDown, ArrowUp, Check, GripVertical, X } from 'lucide-react';
import type { AnyFieldAnalysis, AnyFieldOption } from '@workspace/api-client-react';

export const FIELDS = [
  { id: 'medicine', name: 'طب بشري', topics: ['التهاب الزائدة الدودية', 'قراءة تخطيط القلب', 'الصدمة التأقية'] },
  { id: 'architecture', name: 'هندسة معمارية', topics: ['توزيع الأحمال بالمبنى', 'التهوية الطبيعية', 'معايير إمكانية الوصول'] },
  { id: 'civil', name: 'هندسة مدنية', topics: ['مقاومة الخرسانة', 'تصميم الأساسات', 'الصرف الصحي'] },
  { id: 'electrical', name: 'هندسة كهربائية', topics: ['الدارات المتوازية والمتسلسلة', 'الحماية من التماس الكهربائي', 'محولات الجهد'] },
  { id: 'dentistry', name: 'طب أسنان', topics: ['تسوس الأسنان العميق', 'علاج العصب', 'زراعة الأسنان'] },
] as const;

export function Options({ options, testid, onDone }: { options: { text: string; correct: boolean }[]; testid: string; onDone: (ok: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const locked = picked !== null;
  return <div role="group" aria-label="الخيارات">
    {options.map((o, i) => {
      const cls = !locked ? '' : o.correct ? 'correct' : i === picked ? 'incorrect' : 'dim';
      return <button key={i} type="button" disabled={locked} data-testid={`${testid}-option-${i}`} className={`option ${cls}`}
        onClick={() => { setPicked(i); onDone(o.correct); }}>
        <span>{o.text}</span>
        {locked && o.correct && <Check size={18} aria-label="صحيح" />}
        {locked && !o.correct && i === picked && <X size={18} aria-label="غير صحيح" />}
      </button>;
    })}
  </div>;
}

export const toOpts = (o: AnyFieldOption[]) => o.map(x => ({ text: x.text_ar, correct: x.correct }));

export function scramble<T>(arr: T[], isOrdered: (a: T[]) => boolean): T[] {
  let a = [...arr];
  for (let k = 0; k < 5; k++) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (!isOrdered(a)) return a;
  }
  a = [...arr.slice(1), arr[0]];
  return a;
}

type Item = AnyFieldAnalysis['items'][number];

export function Reorder({ items, onDone }: { items: Item[]; onDone: (ok: boolean) => void }) {
  const correct = [...items].sort((a, b) => a.order_index - b.order_index);
  const [list, setList] = useState<Item[]>(() => scramble(items, a => a.every((x, i) => x.id === correct[i].id)));
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [live, setLive] = useState('');
  const locked = result !== null;
  const move = (from: number, to: number) => {
    if (locked || to < 0 || to >= list.length || from === to) return;
    const n = [...list]; const [x] = n.splice(from, 1); n.splice(to, 0, x); setList(n);
    setLive(`تم نقل العنصر إلى الموضع ${to + 1} من ${n.length}`);
  };
  const submit = () => {
    const ok = list.every((x, i) => x.id === correct[i].id);
    setResult(ok);
    if (!ok) setList(correct);
    onDone(ok);
  };
  return <div>
    <ol className="taf-order" data-testid="list-reorder">
      {list.map((it, i) => <li key={it.id} draggable={!locked} data-testid={`item-reorder-${i}`}
        className={`taf-item ${drag === i ? 'dragging' : ''} ${over === i && drag !== null ? 'over' : ''} ${locked ? (result ? 'right' : 'wrong') : ''}`}
        onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); }}
        onDragOver={e => { e.preventDefault(); setOver(i); }}
        onDrop={e => { e.preventDefault(); if (drag !== null) move(drag, i); setDrag(null); setOver(null); }}
        onDragEnd={() => { setDrag(null); setOver(null); }}>
        <GripVertical size={18} aria-hidden="true" color="#768177" />
        <span className="num">{i + 1}</span>
        <span className="txt">{it.text_ar}</span>
        {!locked && <span className="taf-mv">
          <button type="button" aria-label="نقل لأعلى" disabled={i === 0} data-testid={`button-reorder-up-${i}`} onClick={() => move(i, i - 1)}><ArrowUp size={16} /></button>
          <button type="button" aria-label="نقل لأسفل" disabled={i === list.length - 1} data-testid={`button-reorder-down-${i}`} onClick={() => move(i, i + 1)}><ArrowDown size={16} /></button>
        </span>}
      </li>)}
    </ol>
    <div className="sr-only" style={{ position: 'absolute', left: -9999 }} aria-live="polite">{live}</div>
    {!locked && <div className="taf-actions"><button type="button" className="btn btn-primary" data-testid="button-submit-order" onClick={submit}>تأكيد الترتيب</button></div>}
    {locked && !result && <p className="muted" style={{ marginTop: 12 }} data-testid="text-correct-sequence">الترتيب الصحيح معروض أعلاه.</p>}
  </div>;
}
