type FirstMove = {
  question_ar: string;
  options: { id: string; text_ar: string; correct: boolean }[];
  scaffold_code_on_correct: string;
};

export function validFirstMove(choice: FirstMove, reference: string | undefined) {
  const prefix = choice.scaffold_code_on_correct;
  const tail = prefix.trimEnd().split("\n").at(-1) ?? "";
  return choice.options.filter(option => option.correct).length === 1
    && new Set(choice.options.map(option => option.id)).size === choice.options.length
    && new Set(choice.options.map(option => option.text_ar.trim())).size === choice.options.length
    && !!prefix.trim()
    && !prefix.includes("\r")
    && !/[;}\]]$/.test(tail)
    && !!reference && reference.startsWith(prefix)
    && reference.slice(prefix.length).trim().length > 0
    && !/^[\s;{}()[\],]+$/.test(reference.slice(prefix.length))
    && prefix.trim() !== reference.trim();
}

export function completedConceptEncounters(
  rows: { conceptId: string | null; concept: string; lessonId: string | null; touchesCompleted: number }[],
  id: string, name: string, currentLesson: string | undefined,
) {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  return rows.filter(row => row.touchesCompleted === 5 && row.lessonId !== currentLesson
    && (row.conceptId === id || (!row.conceptId && normalize(row.concept.split(" — ", 1)[0]) === normalize(name)))).length;
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