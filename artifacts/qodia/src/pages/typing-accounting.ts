/** Pure accounting of genuinely typed characters (practice feedback only; never persisted). */
export type InputInfo = { inputType: string; data: string | null; isComposing?: boolean };

export const codePoints = (value: string | null | undefined) => (value ? Array.from(value).length : 0);

/** Characters a single input event genuinely inserted. Composition and replacements are handled elsewhere. */
export function insertedCount(info: InputInfo, netDelta = 0): number {
  if (info.isComposing) return 0;
  switch (info.inputType) {
    case 'insertText': return info.data !== null ? codePoints(info.data) : Math.max(0, Math.min(netDelta, 1));
    case 'insertLineBreak':
    case 'insertParagraph': return 1;
    case '': return info.data === null && netDelta === 1 ? 1 : 0; // very old browsers: single-char delta only
    default: return 0; // paste, drop, yank, delete*, history*, insertCompositionText (counted on commit),
    // insertReplacementText (autocorrect/suggestion swap is not typing, deliberately 0)
  }
}

const DUPLICATE_WINDOW_MS = 60;

export function createTypingCounter() {
  let total = 0;
  let composing = false;
  let lastCommit: { data: string; at: number } | null = null;
  const credit = (amount: number) => {
    if (amount <= 0) return 0;
    const before = Math.floor(total / 5);
    total += amount;
    return Math.floor(total / 5) - before; // practice points earned by this event
  };
  return {
    get total() { return total; },
    get composing() { return composing; },
    reset() { total = 0; composing = false; lastCommit = null; },
    compositionStart() { composing = true; },
    /** Commit exactly once, using composition data (not net length). */
    compositionEnd(data: string | null | undefined, now = Date.now()) {
      composing = false;
      const text = data ?? '';
      if (!text) return 0;
      lastCommit = { data: text, at: now };
      return credit(codePoints(text));
    },
    input(info: InputInfo, netDelta = 0, now = Date.now()) {
      if (composing || info.isComposing) return 0;
      if (lastCommit && info.inputType === 'insertText' && info.data === lastCommit.data && now - lastCommit.at <= DUPLICATE_WINDOW_MS) {
        lastCommit = null; // post-composition duplicate insertText of the same commit
        return 0;
      }
      return credit(insertedCount(info, netDelta));
    },
  };
}
