type FirstMove = {
  question_ar: string;
  options: { id: string; text_ar: string; correct: boolean }[];
  scaffold_code_on_correct: string;
};

/** Optional teaching support must never make an otherwise valid lesson unusable. */
export function withFirstMoveFallback(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { input, reason: null };
  const lesson = input as Record<string, unknown>;
  const rawBuild = lesson.touch4_build;
  if (!rawBuild || typeof rawBuild !== "object" || Array.isArray(rawBuild)) return { input, reason: null };
  const build = rawBuild as Record<string, unknown>;
  const choice = build.first_move_choice;
  let reason: string | null = null;
  if (choice === undefined) reason = "missing";
  else if (!isFirstMove(choice)) reason = "malformed";
  else reason = firstMoveIssue(choice, typeof build.reference_solution === "string" ? build.reference_solution : undefined);
  if (!reason) return { input, reason };
  const { first_move_choice: _discarded, ...directBuild } = build;
  return { input: { ...lesson, touch4_build: directBuild }, reason };
}

function isFirstMove(value: unknown): value is FirstMove {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const choice = value as Record<string, unknown>;
  const text = (value: unknown, limit: number) => typeof value === "string" && value.trim().length > 0 && value.length <= limit;
  return Object.keys(choice).every(key => ["question_ar", "options", "scaffold_code_on_correct"].includes(key))
    && text(choice.question_ar, 300)
    && text(choice.scaffold_code_on_correct, 2000)
    && Array.isArray(choice.options) && choice.options.length >= 2 && choice.options.length <= 3
    && choice.options.every(option => {
      if (!option || typeof option !== "object" || Array.isArray(option)) return false;
      return Object.keys(option).every(key => ["id", "text_ar", "correct"].includes(key))
        && text(option.id, 20) && text(option.text_ar, 300) && typeof option.correct === "boolean";
    });
}

export function validFirstMove(choice: FirstMove, reference: string | undefined) {
  return firstMoveIssue(choice, reference) === null;
}

function firstMoveIssue(choice: FirstMove, reference: string | undefined): string | null {
  const prefix = choice.scaffold_code_on_correct;
  const tail = prefix.trimEnd().split("\n").at(-1) ?? "";
  if (choice.options.filter(option => option.correct).length !== 1) return "ambiguous_correct_answer";
  if (new Set(choice.options.map(option => option.id)).size !== choice.options.length
    || new Set(choice.options.map(option => option.text_ar.trim())).size !== choice.options.length) return "duplicate_options";
  if (!prefix.trim()) return "empty_prefix";
  if (prefix.includes("\r")) return "prefix_carriage_return";
  if (!reference || !reference.startsWith(prefix)) return "prefix_not_reference_start";
  if (!reference.slice(prefix.length).trim() || prefix.trim() === reference.trim()) return "prefix_is_full_solution";
  if (/^[\s;{}()[\],]+$/.test(reference.slice(prefix.length))) return "prefix_leaves_only_delimiters";
  if (/[;}\]]$/.test(tail)) return "prefix_ends_statement";
  return null;
}

export function completedConceptEncounters(
  rows: { conceptId: string | null; concept: string; lessonId: string | null; touchesCompleted: number }[],
  id: string, name: string, currentLesson: string | undefined,
) {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return rows.filter(row => row.touchesCompleted === 5 && row.lessonId !== currentLesson
    && (!row.conceptId || row.conceptId === id)
    && normalize(row.concept.split(" — ", 1)[0]) === normalize(name)).length;
}

export function scaffoldingFor(
  choice: FirstMove | undefined, mastery: number | null, completedEncounters: number, isReview: boolean,
) {
  const tier = !choice || completedEncounters >= 2 || (mastery ?? 0) >= 90
    ? "none" : isReview && (mastery ?? 0) >= 70 ? "reduced" : "guided";
  const prefix = choice?.scaffold_code_on_correct ?? "";
  const chars = Array.from(prefix);
  return {
    tier,
    mastery_score: mastery,
    completed_encounters: completedEncounters,
    prefix: tier === "none" ? "" : tier === "reduced"
      ? chars.slice(0, Math.min(5, Math.max(1, Math.floor(chars.length / 3)))).join("") : prefix,
    legacy_lesson: !choice,
  } as const;
}