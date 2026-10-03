import { useEffect, useRef, useState } from 'react';
import { useUpdateTouch4Activity, type Touch4Support } from '@workspace/api-client-react';
import { IDLE_FALLBACK_MS, TYPING_THROTTLE_MS, acceptActivitySnapshot, activityTracks, nextIdleDelay } from './hint-controls';

type Options = {
  lessonId: string; active: boolean; support: Touch4Support | undefined;
  getCurrent: () => Touch4Support | undefined; onSnapshot: (support: Touch4Support) => void;
};

export function useTouch4Activity(options: Options) {
  const { mutateAsync } = useUpdateTouch4Activity();
  const mutateRef = useRef(mutateAsync); mutateRef.current = mutateAsync;
  const optRef = useRef(options); optRef.current = options;
  const [error, setError] = useState(false);
  const epoch = useRef(0);
  const running = useRef(false);
  const queued = useRef<'typing' | 'idle' | null>(null);
  const lastSent = useRef(0);
  const idleTimer = useRef(0);
  const trailTimer = useRef(0);
  const failed = useRef(false);
  const tracking = activityTracks(options.support, !options.active);
  const hintsUsed = options.support?.hints_used ?? 0;

  function clearTimers() { window.clearTimeout(idleTimer.current); window.clearTimeout(trailTimer.current); idleTimer.current = 0; trailTimer.current = 0; }
  function armIdle(delay: number) {
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => { void send('idle'); }, delay);
  }
  async function send(kind: 'typing' | 'idle') {
    const o = optRef.current;
    if (!activityTracks(o.support, !o.active) || !o.lessonId) return;
    if (running.current) { queued.current = kind === 'idle' || queued.current === 'idle' ? 'idle' : 'typing'; return; }
    running.current = true;
    const mine = epoch.current;
    lastSent.current = performance.now();
    try {
      const snap = await mutateRef.current({ data: { lesson_id: o.lessonId, kind } });
      if (mine !== epoch.current) return;
      const cur = optRef.current;
      if (!acceptActivitySnapshot(cur.getCurrent(), snap, cur.lessonId)) return;
      failed.current = false; setError(false);
      cur.onSnapshot(snap);
      if (!snap.can_reveal_next && activityTracks(snap, !cur.active)) armIdle(nextIdleDelay(snap.next_hint_wait_ms, true));
    } catch {
      if (mine === epoch.current) { failed.current = true; setError(true); window.clearTimeout(idleTimer.current); }
    } finally {
      running.current = false;
      const next = queued.current; queued.current = null;
      // The effect clears old queued work. Any request queued after an epoch
      // change belongs to the new hint/lesson and must not be discarded.
      if (next && !failed.current) void send(next);
    }
  }

  useEffect(() => {
    epoch.current += 1; queued.current = null; failed.current = false; lastSent.current = 0;
    clearTimers(); setError(false);
    const cur = optRef.current.support;
    if (tracking && cur && !cur.can_reveal_next) armIdle(nextIdleDelay(cur.next_hint_wait_ms, false));
    return () => { epoch.current += 1; clearTimers(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracking, options.lessonId, hintsUsed]);

  function recordTyping() {
    const o = optRef.current;
    if (!activityTracks(o.support, !o.active) || o.support?.can_reveal_next || failed.current) return;
    armIdle(IDLE_FALLBACK_MS);
    const since = lastSent.current ? performance.now() - lastSent.current : TYPING_THROTTLE_MS;
    if (since >= TYPING_THROTTLE_MS) { window.clearTimeout(trailTimer.current); trailTimer.current = 0; void send('typing'); return; }
    if (!trailTimer.current) {
      trailTimer.current = window.setTimeout(() => { trailTimer.current = 0; void send('typing'); }, TYPING_THROTTLE_MS - since);
    }
  }
  function retry() { failed.current = false; setError(false); void send('idle'); }
  return { recordTyping, retry, error };
}
