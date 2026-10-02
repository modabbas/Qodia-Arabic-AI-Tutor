export type Touch4HintLevel = 1 | 2 | 3;
export type Touch4HintKind = "guidance" | "similar_example" | "partial_solution";
export type Touch4Hint = {
  level: Touch4HintLevel;
  type: Touch4HintKind;
  text_ar: string;
  example?: string;
  code_example?: string;
};
export type Touch4HintBundle = {
  hints: [Touch4Hint, Touch4Hint, Touch4Hint];
  reference_solution: string;
};

export function touch4HintBundleFailureReason(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "bundle_not_object";
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.hints) || data.hints.length !== 3) return "hints_count_invalid";
  if (typeof data.reference_solution !== "string" || !data.reference_solution.trim()) return "reference_solution_invalid";
  if (Array.from(data.reference_solution).length > 4000) return "reference_solution_too_long";
  const expectedTypes: Touch4HintKind[] = ["guidance", "similar_example", "partial_solution"];
  const texts: string[] = [];
  const codeExamples: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const hint = data.hints[i];
    if (!hint || typeof hint !== "object" || Array.isArray(hint)) return "hint_not_object";
    const item = hint as Record<string, unknown>;
    if (item.level !== i + 1 || item.type !== expectedTypes[i]) return "hint_level_or_type_invalid";
    if (typeof item.text_ar !== "string" || !item.text_ar.trim()) return "hint_text_invalid";
    if (!/[\u0621-\u063A\u0641-\u064A]/u.test(item.text_ar)) return "hint_text_not_arabic";
    if (Array.from(item.text_ar).length > 700) return "hint_text_too_long";
    if (item.example !== undefined
      && (typeof item.example !== "string" || Array.from(item.example).length > 700)) return "hint_example_invalid";
    if (item.code_example !== undefined
      && (typeof item.code_example !== "string" || Array.from(item.code_example).length > 2000)) {
      return "hint_code_example_invalid";
    }
    if (i === 0 && typeof item.code_example === "string" && item.code_example.trim()) {
      return "level1_code_example_forbidden";
    }
    if (i > 0 && (typeof item.code_example !== "string" || !item.code_example.trim())) {
      return "hint_code_example_required";
    }
    if (i === 2 && !/(?:_{2,}|TODO|أكمل)/iu.test(item.code_example as string)) {
      return "level3_placeholder_missing";
    }
    texts.push(item.text_ar.trim());
    codeExamples.push(typeof item.code_example === "string"
      ? item.code_example.normalize("NFKC").replace(/\s+/g, " ").trim()
      : "");
  }
  if (new Set(texts).size !== 3) return "duplicate_hint_text";
  if (codeExamples[1] && codeExamples[1] === codeExamples[2]) return "duplicate_code_example";
  return null;
}

export function parseTouch4HintBundle(value: unknown): Touch4HintBundle | null {
  if (touch4HintBundleFailureReason(value)) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (!Array.isArray(data.hints) || data.hints.length !== 3
    || typeof data.reference_solution !== "string"
    || !data.reference_solution.trim()
    || Array.from(data.reference_solution).length > 4000) return null;
  const expectedTypes: Touch4HintKind[] = ["guidance", "similar_example", "partial_solution"];
  const hints: Touch4Hint[] = [];
  for (let i = 0; i < 3; i += 1) {
    const hint = data.hints[i];
    if (!hint || typeof hint !== "object" || Array.isArray(hint)) return null;
    const item = hint as Record<string, unknown>;
    if (item.level !== i + 1 || item.type !== expectedTypes[i]
      || typeof item.text_ar !== "string" || !item.text_ar.trim()
      || !/[\u0621-\u063A\u0641-\u064A]/u.test(item.text_ar)
      || Array.from(item.text_ar).length > 700) return null;
    if (item.example !== undefined && (typeof item.example !== "string" || Array.from(item.example).length > 700)) return null;
    if (item.code_example !== undefined
      && (typeof item.code_example !== "string" || Array.from(item.code_example).length > 2000)) return null;
    if (i === 0 && typeof item.code_example === "string" && item.code_example.trim()) return null;
    if (i > 0 && (typeof item.code_example !== "string" || !item.code_example.trim())) return null;
    if (i === 2 && !/(?:_{2,}|TODO|أكمل)/iu.test(item.code_example as string)) return null;
    hints.push({
      level: (i + 1) as Touch4HintLevel,
      type: expectedTypes[i],
      text_ar: item.text_ar,
      ...(typeof item.example === "string" ? { example: item.example } : {}),
      ...(typeof item.code_example === "string" ? { code_example: item.code_example } : {}),
    });
  }
  if (new Set(hints.map((hint) => hint.text_ar.trim())).size !== 3) return null;
  const level2Code = hints[1].code_example?.normalize("NFKC").replace(/\s+/g, " ").trim();
  const level3Code = hints[2].code_example?.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (level2Code && level2Code === level3Code) return null;
  return {
    hints: hints as Touch4HintBundle["hints"],
    reference_solution: data.reference_solution,
  };
}

export function canRevealNextHint(
  hintsUsed: number,
  failedAttempts: number,
  failuresAtLastHint: number,
  buildSaved = false,
  solutionViewed = false,
): boolean {
  return !buildSaved && !solutionViewed && hintsUsed < 3
    && failedAttempts > failuresAtLastHint
    && failedAttempts >= hintsUsed + 1;
}

export function canRevealHint(
  hintsUsed: number,
  failedAttempts: number,
  failuresAtLastHint: number,
  level: number,
  buildSaved = false,
  solutionViewed = false,
): boolean {
  return level === hintsUsed + 1
    && canRevealNextHint(hintsUsed, failedAttempts, failuresAtLastHint, buildSaved, solutionViewed);
}

export function touch4XpPenalty(hintsUsed: number, solutionViewed: boolean): number {
  return Math.min(50, hintsUsed * 10 + (solutionViewed ? 20 : 0));
}

export function firstTryBonusEligible(
  reservedAttemptIndex: number,
  failedAttempts: number,
  hintsUsed: number,
  solutionViewed: boolean,
  hasPriorSubmissionEvidence: boolean,
): boolean {
  return reservedAttemptIndex === 1 && failedAttempts === 0 && hintsUsed === 0
    && !solutionViewed && !hasPriorSubmissionEvidence;
}

export function touch4SessionXp(baseXp: number, firstTryBonus: number, penalty: number, buildSaved: boolean): number {
  return Math.max(0, baseXp + (buildSaved ? firstTryBonus - penalty : 0));
}

export function xpDeltaForSession(previousXp: number, earnedXp: number): number {
  return earnedXp - previousXp;
}