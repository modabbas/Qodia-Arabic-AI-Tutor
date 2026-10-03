import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject, type TextareaHTMLAttributes } from 'react';
import s from './Touch4WorkArea.module.css';

export type Touch4WorkAreaProps = {
  mode: 'drag-order' | 'fill-blank' | 'free-write';
  fixedCode: string;
  starterPreview: string;
  code: string;
  chunks: string[];
  order: number[];
  onOrderChange: (order: number[]) => void;
  disabled: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  textareaProps: TextareaHTMLAttributes<HTMLTextAreaElement>;
  renderCode: (code: string) => ReactNode;
  mirror?: ReactNode;
};

const moveItem = (list: number[], from: number, to: number) => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
const num = (n: number) => n.toLocaleString('ar-EG');

export function Touch4WorkArea({ mode, fixedCode, starterPreview, code, chunks, order, onOrderChange, disabled, inputRef, textareaProps, renderCode, mirror }: Touch4WorkAreaProps) {
  const rows = useRef(new Map<number, HTMLLIElement>());
  const [dragId, setDragId] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);
  const [status, setStatus] = useState('');
  const drag = useRef<{ id: number; pointerId: number; startY: number } | null>(null);

  // Keep only valid unique indices; append any missing so the list is always a permutation.
  const safeOrder = (() => {
    const seen = new Set<number>();
    const out = order.filter(i => Number.isInteger(i) && i >= 0 && i < chunks.length && !seen.has(i) && seen.add(i));
    for (let i = 0; i < chunks.length; i++) if (!seen.has(i)) out.push(i);
    return out;
  })();

  const commit = (next: number[], id: number) => {
    if (next === safeOrder) return;
    onOrderChange(next);
    setStatus(`انتقل المقطع ${num(id + 1)} إلى الموضع ${num(next.indexOf(id) + 1)} من ${num(next.length)}`);
  };
  const step = (id: number, delta: number) => {
    if (disabled) return;
    const from = safeOrder.indexOf(id);
    commit(moveItem(safeOrder, from, from + delta), id);
  };
  const onKey = (event: KeyboardEvent, id: number) => {
    if (disabled) return;
    const k = event.key;
    const from = safeOrder.indexOf(id);
    if (k === 'ArrowUp' || k === 'ArrowDown') { event.preventDefault(); step(id, k === 'ArrowUp' ? -1 : 1); }
    else if (k === 'Home') { event.preventDefault(); commit(moveItem(safeOrder, from, 0), id); }
    else if (k === 'End') { event.preventDefault(); commit(moveItem(safeOrder, from, safeOrder.length - 1), id); }
  };

  const onDown = (event: PointerEvent<HTMLButtonElement>, id: number) => {
    if (disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, pointerId: event.pointerId, startY: event.clientY };
    setDragId(id); setOffset(0);
  };
  const onMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    if (disabled) return endDrag(event);
    const others = safeOrder.filter(i => i !== d.id);
    // Insertion index = number of other rows whose midpoint is above the pointer.
    let target = 0;
    for (const i of others) {
      const el = rows.current.get(i);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (event.clientY > r.top + r.height / 2) target += 1;
    }
    const from = safeOrder.indexOf(d.id);
    const next = moveItem(safeOrder, from, target);
    if (next !== safeOrder) {
      // Row slots shift by the moved distance; compensate so the dragged row stays under the finger.
      const el = rows.current.get(d.id);
      const before = el?.getBoundingClientRect().top ?? 0;
      commit(next, d.id);
      requestAnimationFrame(() => {
        const after = rows.current.get(d.id)?.getBoundingClientRect().top ?? before;
        d.startY += after - before;
        setOffset(prev => prev - (after - before));
      });
    }
    setOffset(event.clientY - d.startY);
  };
  const endDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current && drag.current.pointerId === event.pointerId) {
      drag.current = null; setDragId(null); setOffset(0);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const showFixed = fixedCode.length > 0;
  const showExample = !showFixed && starterPreview.length > 0;

  return <div className={s.area} data-testid="touch4-work-area" data-mode={mode}>
    <div>
      <p className={s.label}>{showFixed ? 'بداية جاهزة (للقراءة فقط)' : 'مثال للقراءة فقط'}<span className={s.badge}>{showFixed ? 'ما بتتعدل' : 'مو جزء من كودك'}</span></p>
      <pre className={`${s.fixed} ${showFixed ? '' : s.example}`} data-testid="text-fixed-starter" aria-label={showFixed ? 'الكود الجاهز فوق، للقراءة فقط' : 'مثال للقراءة فقط'} tabIndex={0}>{showFixed ? renderCode(fixedCode) : showExample ? renderCode(starterPreview) : 'لا توجد أسطر ثابتة في هذا الملف بعد.'}</pre>
    </div>

    {mode === 'drag-order' ? <div>
      <p className={s.label}>رتّب المقاطع بالسحب أو بأزرار الأسهم</p>
      <ol className={s.list} data-testid="drag-order-list" aria-label="مقاطع الكود قابلة لإعادة الترتيب">
        {safeOrder.map((id, pos) => <li key={id} ref={el => { if (el) rows.current.set(id, el); else rows.current.delete(id); }}
          className={`${s.row} ${dragId === id ? s.dragging : ''}`} data-testid={`drag-chunk-${id}`}
          style={dragId === id ? { transform: `translateY(${offset}px)` } : undefined}>
          <button type="button" className={s.handle} disabled={disabled} data-testid={`drag-handle-${id}`}
            aria-label={`اسحب المقطع ${num(id + 1)}، الموضع ${num(pos + 1)} من ${num(safeOrder.length)}. استخدم الأسهم للتحريك`}
            onPointerDown={e => onDown(e, id)} onPointerMove={onMove} onPointerUp={endDrag} onPointerCancel={endDrag}
            onLostPointerCapture={() => { if (drag.current?.id === id) { drag.current = null; setDragId(null); setOffset(0); } }}
            onKeyDown={e => onKey(e, id)}><span aria-hidden="true">::</span></button>
          <span className={s.pos} aria-hidden="true">{num(pos + 1)}</span>
          <pre className={s.chunk}>{chunks[id]}</pre>
          <div className={s.moves}>
            <button type="button" className={s.move} disabled={disabled || pos === 0} onClick={() => step(id, -1)} data-testid={`move-chunk-up-${id}`} aria-label={`حرّك المقطع ${num(id + 1)} للأعلى`}><span aria-hidden="true">▲</span></button>
            <button type="button" className={s.move} disabled={disabled || pos === safeOrder.length - 1} onClick={() => step(id, 1)} data-testid={`move-chunk-down-${id}`} aria-label={`حرّك المقطع ${num(id + 1)} للأسفل`}><span aria-hidden="true">▼</span></button>
          </div>
        </li>)}
      </ol>
      <div className={s.live} role="status" aria-live="polite">{status}</div>
    </div> : <div>
      <p className={`${s.label} ${s.entryLabel}`}>{showFixed ? 'اكتب أنت الباقي هون' : 'اكتب كودك هون'}</p>
      <div className={s.codeEntry}>
        <pre className={s.mirror} aria-hidden="true">{mirror ?? renderCode(code)}</pre>
        <textarea {...textareaProps} ref={inputRef} className={s.textarea} value={code} disabled={disabled} data-testid="input-code-answer" />
      </div>
    </div>}
  </div>;
}

export default Touch4WorkArea;
