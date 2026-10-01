import { useCallback, useEffect, useRef, useState } from 'react';
import s from './Session.module.css';

const digits = (value: number) => String(value).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const SOUND_KEY = 'kodia-session-sound';

/** Sound is OFF unless the learner explicitly chose "true". Storage failures fall back to off. */
export function readSound(): boolean {
  try { return window.localStorage.getItem(SOUND_KEY) === 'true'; } catch { return false; }
}
export function writeSound(on: boolean) {
  try { window.localStorage.setItem(SOUND_KEY, String(on)); } catch { /* storage unavailable */ }
}

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)';
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches);
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia(query);
    const onChange = () => setReduced(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

type Kind = 'float' | 'typing' | 'spark' | 'bit' | 'dot';
type Item = { id: number; kind: Kind; x: number; y: number; text?: string; color?: string; dx?: number; dy?: number; expires: number };
const palette = ['#22c55e', '#f5b84a', '#7cc7ff', '#c792ea'];
const sparkColors = ['#22c55e', '#f5b84a', '#c792ea'];
const small = () => window.matchMedia('(max-width:600px)').matches;

/** Bounded particle store: one prune timer for all particles, no per-particle timers. */
export function useFx(reduced: boolean) {
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const [items, setItems] = useState<Item[]>([]);
  const idRef = useRef(0);
  useEffect(() => { if (reduced) setItems([]); }, [reduced]);
  const add = useCallback((list: Omit<Item, 'id' | 'expires'>[], life: number) => {
    if (reducedRef.current) return;
    const now = Date.now();
    const cap = small() ? 36 : 70;
    setItems(prev => [...prev.filter(i => i.expires > now), ...list.map(i => ({ ...i, id: ++idRef.current, expires: now + life }))].slice(-cap));
  }, []);
  useEffect(() => {
    if (!items.length) return;
    const next = Math.min(...items.map(i => i.expires));
    const id = window.setTimeout(() => { const now = Date.now(); setItems(prev => prev.filter(i => i.expires > now)); }, Math.max(30, next - Date.now() + 30));
    return () => window.clearTimeout(id);
  }, [items]);

  const float = useCallback((x: number, y: number, text: string) => { add([{ kind: 'float', x, y, text }], 420); }, [add]);
  const typing = useCallback((x: number, y: number, text: string) => { add([{ kind: 'typing', x, y, text }], 1000); }, [add]);
  const dot = useCallback((x: number, y: number) => { add([{ kind: 'dot', x, y, color: '#22c55e' }], 600); }, [add]);
  const sparkles = useCallback((x: number, y: number) => {
    const n = small() ? 3 : 5;
    add(Array.from({ length: n }, (_, i) => ({ kind: 'spark' as const, x, y, text: '✨', color: sparkColors[i % 3], dx: Math.cos(i * 1.3 - 1) * 46, dy: -Math.abs(Math.sin(i * 1.3)) * 44 - 8 })), 420);
  }, [add]);
  const confetti = useCallback((x: number, y: number, count = 18) => {
    const n = small() ? Math.round(count * .55) : count;
    add(Array.from({ length: n }, (_, i) => ({ kind: 'bit' as const, x, y, color: palette[i % 4], dx: Math.cos(i * 2.4) * (50 + i * 4), dy: Math.sin(i * 2.4) * (50 + i * 4) - 40 })), 900);
  }, [add]);
  const clear = useCallback(() => setItems([]), []);
  return { items, float, typing, dot, sparkles, confetti, clear };
}

export function FxLayer({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return <div className={s.fxlayer} aria-hidden="true">{items.map(i => <span key={i.id} className={s[`fx_${i.kind}`]}
    style={{ left: i.x, top: i.y, color: i.color, background: i.kind === 'bit' || i.kind === 'dot' ? i.color : undefined, ['--dx' as string]: `${i.dx ?? 0}px`, ['--dy' as string]: `${i.dy ?? 0}px` }}>{i.text}</span>)}</div>;
}

/** Approximate caret position inside the monospace code textarea (14px / 1.7 line height). */
export function caretPoint(el: HTMLTextAreaElement) {
  const rect = el.getBoundingClientRect();
  const lines = el.value.slice(0, el.selectionStart ?? el.value.length).split('\n');
  const x = rect.left + 14 + lines[lines.length - 1].length * 8.4 - el.scrollLeft;
  const y = rect.top + 14 + (lines.length - 1) * 23.8 - el.scrollTop;
  return { x: Math.min(Math.max(x, rect.left + 14), rect.right - 24), y: Math.min(Math.max(y, rect.top + 8), rect.bottom - 8) };
}

const idleMessages = ['خذ وقتك، فكر فيها 💭', 'تحتاج تلميح؟', 'أنت أقرب مما تظن 💪'];
export function IdleMentor({ active, resetKey }: { active: boolean; resetKey: string }) {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    setMessage(null);
    if (!active) return;
    let idle = 0; let hide = 0;
    const arm = () => {
      window.clearTimeout(idle); window.clearTimeout(hide); setMessage(null);
      idle = window.setTimeout(() => {
        setMessage(idleMessages[Math.floor(Math.random() * idleMessages.length)]);
        hide = window.setTimeout(() => setMessage(null), 5000);
      }, 15000);
    };
    arm();
    const events = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'] as const;
    events.forEach(name => window.addEventListener(name, arm, { passive: true }));
    return () => { window.clearTimeout(idle); window.clearTimeout(hide); events.forEach(name => window.removeEventListener(name, arm)); };
  }, [active, resetKey]);
  if (!message) return null;
  return <div className={s.mentor} role="status" data-testid="status-idle-mentor"><span className={s.mentorface} aria-hidden="true">م</span><span>{message}</span></div>;
}

export function CountUp({ value, reduced, duration = 900, delay = 0 }: { value: number; reduced: boolean; duration?: number; delay?: number }) {
  const [shown, setShown] = useState(reduced ? value : 0);
  useEffect(() => {
    if (reduced) { setShown(value); return; }
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setShown(0);
    const wait = window.setTimeout(() => { start = performance.now(); frame = requestAnimationFrame(tick); }, delay);
    return () => { window.clearTimeout(wait); cancelAnimationFrame(frame); };
  }, [value, reduced, duration, delay]);
  return <>{digits(shown)}</>;
}
