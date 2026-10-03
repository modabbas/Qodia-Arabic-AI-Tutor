import { FINAL_DEFENSE_MIN_COMPLETED_CONCEPTS } from "../../../../lib/api-zod/src/judge-demo-config.ts";

export const DEFENSE_QUESTION_COUNT = 5;
export const DEFENSE_QUESTION_SECONDS = 60;
export const DEFENSE_START_DELAY_MS = 4_000;
// Bounded transport grace accepts a timer-edge payload, but elapsed time still clamps at 60 seconds.
export const DEFENSE_DELIVERY_GRACE_MS = 2_000;
export const MIN_DEFENSE_CONCEPTS = FINAL_DEFENSE_MIN_COMPLETED_CONCEPTS;

export type DefenseConcept = {
  status: string;
  mastery_score: number | null;
  name_en: string;
  name_ar: string;
};

export type DefenseFile = { path: string; content: string; status: string; conceptNameEn?: string };

export type DefenseQuestion = {
  question_number: number;
  professor: string;
  role: string;
  question_text: string;
  difficulty: "basic" | "intermediate" | "advanced";
  concept_tested: string;
  file_reference: string;
  time_limit_seconds: 60;
  student_answer: string | null;
  draft: string;
  answered_at: string | null;
  points: number | null;
  time_used_seconds: number | null;
  evaluation_status: "unanswered" | "pending" | "failed" | "scored";
  strengths: string[];
  weaknesses: string[];
  professor_reaction: string | null;
  mini_feedback: string | null;
  would_pass: boolean | null;
  ideal_answer_points: string[];
  lesson_context: string;
  template_id: string | null;
  evaluation_started_at?: string | null;
  evaluation_claim_token?: string | null;
};

const committee = [
  { professor: "د. حسن", role: "رئيس اللجنة" },
  { professor: "د. فاطمة", role: "مُقيّم تقني" },
  { professor: "د. أحمد", role: "المشرف" },
  { professor: "د. حسن", role: "رئيس اللجنة" },
  { professor: "د. فاطمة", role: "مُقيّم تقني" },
] as const;

export function summarizeEligibility(concepts: DefenseConcept[], files: DefenseFile[]) {
  const completed = concepts.filter((concept) => concept.status === "completed");
  const savedFiles = files.filter((file) => file.status === "complete" && file.content.trim().length > 0);
  const scores = completed.flatMap((concept) =>
    typeof concept.mastery_score === "number" && Number.isFinite(concept.mastery_score)
      ? [concept.mastery_score]
      : []);
  const eligible = completed.length >= MIN_DEFENSE_CONCEPTS && savedFiles.length > 0;
  const warning = completed.length < MIN_DEFENSE_CONCEPTS
    ? `تحتاج إكمال ${String(MIN_DEFENSE_CONCEPTS).replace(/\d/g, digit => "٠١٢٣٤٥٦٧٨٩"[Number(digit)])} مفاهيم مدروسة على الأقل.`
    : savedFiles.length === 0
      ? "لا توجد ملفات مشروع مكتملة ومحفوظة بكود فعلي بعد؛ أكمل ملفاً واحداً على الأقل."
      : completed.length < 20
        ? "يُوصى بإكمال ٢٠ مفهوماً أو أكثر قبل بدء المناقشة."
        : null;
  return {
    completedConcepts: completed.length,
    averageMastery: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null,
    eligible,
    warning,
    savedFiles,
  };
}

export function professorForQuestion(index: number) {
  return committee[index]!;
}

export function expectedDifficulty(questionNumber: number): DefenseQuestion["difficulty"] {
  if (questionNumber === 1) return "basic";
  if (questionNumber === 2 || questionNumber === 3) return "intermediate";
  return "advanced";
}

function normalizeConceptAlias(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase()
    .replace(/[\u0640\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ");
}

function hasAliasBoundary(value: string, start: number, end: number): boolean {
  const isWordCharacter = (character: string | undefined) =>
    character !== undefined && /[\p{L}\p{N}]/u.test(character);
  const previous = value[start - 1];
  const attachedArabicPrefix = previous !== undefined
    && /[وبفلکك]/u.test(previous)
    && !isWordCharacter(value[start - 2]);
  return (!isWordCharacter(previous) || attachedArabicPrefix) && !isWordCharacter(value[end]);
}

function textMentionsAlias(text: string, alias: string): boolean {
  const normalizedText = normalizeConceptAlias(text);
  const normalizedAlias = normalizeConceptAlias(alias);
  if (!normalizedAlias) return false;
  let offset = normalizedText.indexOf(normalizedAlias);
  while (offset >= 0) {
    if (hasAliasBoundary(normalizedText, offset, offset + normalizedAlias.length)) return true;
    offset = normalizedText.indexOf(normalizedAlias, offset + 1);
  }
  return false;
}

export function resolveStudiedConceptAlias(alias: string, concepts: DefenseConcept[]): DefenseConcept | undefined {
  const normalizedAlias = normalizeConceptAlias(alias);
  if (!normalizedAlias) return undefined;
  const matches = concepts.filter((concept) => concept.status === "completed"
    && [concept.name_en, concept.name_ar].some((knownAlias) => normalizeConceptAlias(knownAlias) === normalizedAlias));
  return matches.length === 1 ? matches[0] : undefined;
}

export function resolveGeneratedConceptAlias(
  alias: string,
  concepts: DefenseConcept[],
  questionNumber: number,
): DefenseConcept | undefined {
  const exact = resolveStudiedConceptAlias(alias, concepts);
  if (exact || questionNumber !== 4) return exact;
  const mentioned = concepts.filter((concept) => concept.status === "completed"
    && questionMentionsConcept(alias, concept));
  return mentioned.length === 2 ? mentioned[0] : undefined;
}

export function questionMentionsConcept(question: string, concept: DefenseConcept): boolean {
  return [concept.name_en, concept.name_ar].some((alias) => textMentionsAlias(question, alias));
}

export function questionMentionsSecondStudiedConcept(
  question: string,
  primary: DefenseConcept,
  concepts: DefenseConcept[],
): boolean {
  return concepts.some((concept) => concept.status === "completed"
    && concept !== primary
    && questionMentionsConcept(question, concept));
}

export function validGeneratedQuestion(
  value: unknown,
  questionNumber: number,
  concepts: DefenseConcept[],
  files: DefenseFile[],
): value is { question: string; concept_tested: string; file_reference: string; ideal_answer_points: string[] } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.question !== "string" || candidate.question.trim().length < 20
    || typeof candidate.concept_tested !== "string"
    || typeof candidate.file_reference !== "string"
    || !Array.isArray(candidate.ideal_answer_points)
    || candidate.ideal_answer_points.length < 2
    || !candidate.ideal_answer_points.every((point) => typeof point === "string" && point.trim().length > 0)) return false;
  const concept = resolveStudiedConceptAlias(candidate.concept_tested, concepts);
  const file = files.find((entry) =>
    entry.status === "complete" && entry.content.trim().length > 0 && entry.path === candidate.file_reference);
  return Boolean(concept && file && /[\u0600-\u06FF]/.test(candidate.question)
    && candidate.question.includes(file.path)
    && questionMentionsConcept(candidate.question, concept) && questionNumber >= 1 && questionNumber <= 5);
}

export function newDefenseQuestion(args: {
  index: number;
  question: string;
  concept: string;
  file: DefenseFile;
  difficulty: DefenseQuestion["difficulty"];
  idealPoints: string[];
  lessonContext: string;
  templateId: string | null;
}): DefenseQuestion {
  const { professor, role } = professorForQuestion(args.index);
  return {
    question_number: args.index + 1,
    professor,
    role,
    question_text: args.question,
    difficulty: args.difficulty,
    concept_tested: args.concept,
    file_reference: args.file.path,
    time_limit_seconds: DEFENSE_QUESTION_SECONDS,
    student_answer: null,
    draft: "",
    answered_at: null,
    points: null,
    time_used_seconds: null,
    evaluation_status: "unanswered",
    strengths: [],
    weaknesses: [],
    professor_reaction: null,
    mini_feedback: null,
    would_pass: null,
    ideal_answer_points: args.idealPoints,
    lesson_context: args.lessonContext,
    template_id: args.templateId,
    evaluation_started_at: null,
    evaluation_claim_token: null,
  };
}

export function questionElapsedSeconds(startedAt: Date, now: Date): number {
  return Math.max(0, Math.min(DEFENSE_QUESTION_SECONDS, Math.floor((now.getTime() - startedAt.getTime()) / 1000)));
}

export function questionRemainingSeconds(deadlineAt: Date | null, now: Date): number {
  if (!deadlineAt) return 0;
  return Math.max(0, Math.min(DEFENSE_QUESTION_SECONDS, Math.ceil((deadlineAt.getTime() - now.getTime()) / 1000)));
}

export function matchesSimulationOwner(
  row: { id: string; userId: string } | null | undefined,
  userId: string,
  simulationId: string,
): boolean {
  return Boolean(row && row.userId === userId && row.id === simulationId);
}

export function isCurrentEvaluationClaim(question: DefenseQuestion, claimToken: string): boolean {
  return Boolean(claimToken && question.evaluation_claim_token === claimToken);
}

export function canSaveDraftWithinGrace(deadlineAt: Date, now: Date): boolean {
  return now.getTime() <= deadlineAt.getTime() + DEFENSE_DELIVERY_GRACE_MS;
}

export function isIdenticalLockedAnswer(storedAnswer: string, submittedAnswer: string): boolean {
  return storedAnswer === submittedAnswer;
}

export function getLockedAnswer(
  question: DefenseQuestion,
  submittedAnswer: string,
  now: Date,
  startedAt: Date | null,
  deadlineAt: Date | null,
) {
  const acceptanceDeadline = deadlineAt
    ? deadlineAt.getTime() + DEFENSE_DELIVERY_GRACE_MS
    : startedAt
      ? startedAt.getTime() + DEFENSE_QUESTION_SECONDS * 1000 + DEFENSE_DELIVERY_GRACE_MS
      : 0;
  const isExpired = acceptanceDeadline
    ? now.getTime() > acceptanceDeadline
    : startedAt
      ? now.getTime() > startedAt.getTime() + DEFENSE_QUESTION_SECONDS * 1000 + DEFENSE_DELIVERY_GRACE_MS
      : false;
  return {
    answer: isExpired ? question.draft : submittedAnswer,
    timeUsed: startedAt
      ? questionElapsedSeconds(startedAt, now)
      : DEFENSE_QUESTION_SECONDS,
    isExpired,
  };
}

export function privateSafeQuestion(question: DefenseQuestion, revealPrivate: boolean) {
  const {
    lesson_context: _lessonContext,
    template_id: _templateId,
    evaluation_started_at: _evaluationStartedAt,
    evaluation_claim_token: _evaluationClaimToken,
    ideal_answer_points: privatePoints,
    ...publicQuestion
  } = question;
  return { ...publicQuestion, ideal_answer_points: revealPrivate ? privatePoints : [] };
}

export function aggregateDefense(questions: DefenseQuestion[]) {
  const scored = questions.filter((question) =>
    question.evaluation_status === "scored" && question.points !== null);
  if (scored.length !== DEFENSE_QUESTION_COUNT) {
    throw new Error("DEFENSE_NOT_FULLY_SCORED");
  }
  const overallScore = Math.round(scored.reduce((sum, question) => sum + (question.points ?? 0), 0) / DEFENSE_QUESTION_COUNT);
  const weakConcepts = scored.filter((question) => (question.points ?? 0) < 70)
    .map((question) => question.concept_tested);
  const verdict = overallScore >= 70
    ? `بلغ متوسط إجاباتك ${overallScore} من ١٠٠، وهو فوق حد الاجتياز المحدد عند ٧٠. ${weakConcepts.length
      ? `المفاهيم التي تستحق مراجعة إضافية: ${weakConcepts.join("، ")}.`
      : "لم تسجل مفاهيم دون حد الاجتياز في هذه المحاولة."}`
    : `بلغ متوسط إجاباتك ${overallScore} من ١٠٠، وهو دون حد الاجتياز المحدد عند ٧٠. راجع المفاهيم التي أظهرت فيها الإجابات نقاط ضعف قبل إعادة المحاكاة.`;
  return { overallScore, weakConcepts: [...new Set(weakConcepts)], verdict };
}
