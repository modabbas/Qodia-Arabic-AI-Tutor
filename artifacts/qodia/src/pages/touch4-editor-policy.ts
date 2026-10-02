/** Restored student work takes priority over a suggested start; never replace a saved draft. */
export function resolveScaffold(tier: string, suggested: string, unlocked: boolean, code: string) {
  const restored = !!code.trim();
  const ready = tier !== 'guided' || unlocked || restored;
  const prefix = !ready || tier === 'none' || (restored && !code.startsWith(suggested)) ? '' : suggested;
  return { ready, prefix };
}

export function keepsLockedPrefix(value: string, prefix: string) {
  return value.startsWith(prefix);
}

export function restoreStudentDraft(current: string, draft: string, automaticPrefix: string) {
  return !current || current === automaticPrefix ? draft : current;
}

export function editableSelection(start: number, end: number, prefixLength: number) {
  return [Math.max(prefixLength, start), Math.max(prefixLength, end)] as const;
}