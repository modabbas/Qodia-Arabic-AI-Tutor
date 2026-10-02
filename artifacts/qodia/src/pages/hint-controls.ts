export type HintControlsState = {
  hints_used: number; failed_attempts: number; can_reveal_next: boolean;
  build_saved: boolean; solution_viewed: boolean;
};
export function hintButtonState(support: HintControlsState | undefined, level: number, completed: boolean) {
  if (!support || !Number.isInteger(support.hints_used) || support.hints_used < 0
    || support.hints_used > 3 || !Number.isInteger(level) || level < 1 || level > 3) return 'locked';
  if (level <= support.hints_used) return 'unlocked';
  return !completed && !support.build_saved && !support.solution_viewed
    && level === support.hints_used + 1 && support.failed_attempts >= level
    && support.can_reveal_next ? 'available' : 'locked';
}
export function hintCanDisplay(hint: { level: number; text_ar: string; example?: string; code_example?: string }) {
  return hint.level !== 3 || !hint.example?.trim() && !hint.code_example?.trim() && /[؟?]/u.test(hint.text_ar);
}