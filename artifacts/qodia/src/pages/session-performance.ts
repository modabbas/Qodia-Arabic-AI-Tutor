type TouchOutcome = { passed: boolean } | undefined;

/** Mastery tracks five touches, not six individual defense answers or eventual retries. */
export function sessionPerformance(
  outcomes: readonly TouchOutcome[],
  defenseFirstPass: boolean,
  elapsedMilliseconds: number,
) {
  const teachingCorrect = [0, 1, 2, 3].filter(index => outcomes[index]?.passed).length;
  const defenseCorrect = Boolean(defenseFirstPass && outcomes[4]?.passed);
  return {
    touches_correct: teachingCorrect + Number(defenseCorrect),
    completion_time: Math.max(0, Number.isFinite(elapsedMilliseconds) ? elapsedMilliseconds : 0) / 60_000,
    build_passed: Boolean(outcomes[3]?.passed),
  };
}