export type HintControlsState = {
  hints_used: number; failed_attempts: number; can_reveal_next: boolean;
  build_saved: boolean; solution_viewed: boolean;
};
export function hintButtonState(support: HintControlsState | undefined, level: number, completed: boolean) {
  if (!support || !Number.isInteger(support.hints_used) || support.hints_used < 0
    || support.hints_used > 3 || !Number.isInteger(level) || level < 1 || level > 3) return 'locked';
  if (level <= support.hints_used) return 'unlocked';
  return !completed && !support.build_saved && !support.solution_viewed
    && level === support.hints_used + 1 && support.can_reveal_next ? 'available' : 'locked';
}
export function hintCanDisplay(hint: { level: number; text_ar: string; example?: string; code_example?: string }) {
  return hint.level !== 3 || !hint.example?.trim() && !hint.code_example?.trim() && /[؟?]/u.test(hint.text_ar);
}
export const IDLE_FALLBACK_MS = 35_000;
export const TYPING_THROTTLE_MS = 1_500;
const MIN_RECHECK_MS = 2_000;
type Gate = { lesson_id: string; hints_used: number; build_saved: boolean; solution_viewed: boolean; can_reveal_next: boolean };

/** المؤقّت شغّال فقط بعد فتح التلميح ١ أو ٢ وقبل الحفظ أو الحل. */
export function activityTracks(support: Gate | undefined, completed: boolean) {
  return !!support && !completed && !support.build_saved && !support.solution_viewed
    && (support.hints_used === 1 || support.hints_used === 2);
}

/** يقرّر إذا كانت لقطة الخادم المتأخرة آمنة للتطبيق (لا قديمة ولا تُعيد القفل). */
export function acceptActivitySnapshot(current: Gate | undefined, snap: Gate, lessonId: string) {
  if (snap.lesson_id !== lessonId) return false;
  if (!current || current.lesson_id !== lessonId) return false;
  if (snap.hints_used < current.hints_used) return false;
  if (current.build_saved && !snap.build_saved) return false;
  if (current.solution_viewed && !snap.solution_viewed) return false;
  if (snap.hints_used === current.hints_used && current.can_reveal_next && !snap.can_reveal_next) return false;
  return true;
}

export function nextIdleDelay(waitMs: number | null | undefined, afterResponse: boolean) {
  const wait = typeof waitMs === 'number' && Number.isFinite(waitMs) && waitMs >= 0 ? waitMs : IDLE_FALLBACK_MS;
  return afterResponse ? Math.max(wait, MIN_RECHECK_MS) : wait;
}
