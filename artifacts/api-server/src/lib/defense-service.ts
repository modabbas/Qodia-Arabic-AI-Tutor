import { and, desc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  db,
  defenseSimulationsTable,
  learningMapsTable,
  projectFilesTable,
  type DefenseSimulation as DefenseSimulationRow,
} from "@workspace/db";
import { aggregateDefense, canSaveDraftWithinGrace, DEFENSE_QUESTION_COUNT, DEFENSE_QUESTION_SECONDS, DEFENSE_START_DELAY_MS, getLockedAnswer, isCurrentEvaluationClaim, isIdenticalLockedAnswer, matchesSimulationOwner, privateSafeQuestion, questionRemainingSeconds, summarizeEligibility, type DefenseConcept, type DefenseFile, type DefenseQuestion } from "./defense-rules.ts";
import { evaluateDefenseAnswer, generateDefenseQuestions } from "./defense-generation.ts";
import { logger } from "./logger.ts";

type DefenseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type QuestionWithStart = DefenseQuestion & { evaluation_started_at?: string | null };

export class DefenseServiceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "DefenseServiceError";
  }
}

function throwIfMissing<T>(value: T | undefined, code = "DEFENSE_NOT_FOUND"): T {
  if (!value) throw new DefenseServiceError(code);
  return value;
}

async function lockUser(tx: DefenseTransaction, userId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId})::bigint)`);
}

function toResponse(row: DefenseSimulationRow, now = new Date()) {
  const questions = row.questions as QuestionWithStart[];
  const activeQuestion = row.status === "active" ? questions[row.currentIndex] : undefined;
  const timerRunning = activeQuestion?.evaluation_status === "unanswered";
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    project_name: row.projectName,
    tech_stack: row.techStack,
    questions: questions.map((question) => privateSafeQuestion(question, row.status === "completed")),
    current_index: row.currentIndex,
    current_question_started_at: timerRunning ? row.currentQuestionStartedAt?.toISOString() ?? null : null,
    deadline_at: timerRunning ? row.deadlineAt?.toISOString() ?? null : null,
    server_now: now.toISOString(),
    remaining_seconds: timerRunning ? questionRemainingSeconds(row.deadlineAt, now) : 0,
    overall_score: row.overallScore,
    verdict: row.verdict,
    weak_concepts: row.weakConcepts,
    completed_at: row.completedAt?.toISOString() ?? null,
    answered_count: questions.filter((question) => question.evaluation_status !== "unanswered").length,
  };
}

function asConcepts(concepts: unknown): DefenseConcept[] {
  if (!Array.isArray(concepts)) return [];
  return concepts.flatMap((concept) => {
    if (!concept || typeof concept !== "object") return [];
    const item = concept as Record<string, unknown>;
    if (typeof item.status !== "string" || typeof item.name_en !== "string" || typeof item.name_ar !== "string") return [];
    return [{
      status: item.status,
      name_en: item.name_en,
      name_ar: item.name_ar,
      mastery_score: typeof item.mastery_score === "number" ? item.mastery_score : null,
    }];
  });
}

function asFiles(rows: { path: string; content: string; status: string; conceptNameEn: string }[]): DefenseFile[] {
  return rows.map((file) => ({
    path: file.path,
    content: file.content,
    status: file.status,
    conceptNameEn: file.conceptNameEn,
  }));
}

function publicFileCount(files: DefenseFile[]) {
  return files.filter((file) => file.status === "complete" && file.content.trim().length > 0).length;
}

async function ownedSimulation(tx: DefenseTransaction, userId: string, simulationId: string, lock = false) {
  let query = tx.select().from(defenseSimulationsTable).where(and(
    eq(defenseSimulationsTable.id, simulationId),
    eq(defenseSimulationsTable.userId, userId),
  )).limit(1);
  if (lock) query = query.for("update") as typeof query;
  const [row] = await query;
  return matchesSimulationOwner(row, userId, simulationId) ? row : undefined;
}

export async function getDefenseSimulation(userId: string, simulationId: string) {
  const [row] = await db.select().from(defenseSimulationsTable).where(and(
    eq(defenseSimulationsTable.id, simulationId),
    eq(defenseSimulationsTable.userId, userId),
  )).limit(1);
  return toResponse(throwIfMissing(row));
}

export async function getDefenseSummary(userId: string) {
  const [map] = await db.select().from(learningMapsTable).where(eq(learningMapsTable.userId, userId)).limit(1);
  const fileRows = await db.select({
    path: projectFilesTable.path,
    content: projectFilesTable.content,
    status: projectFilesTable.status,
    conceptNameEn: projectFilesTable.conceptNameEn,
  }).from(projectFilesTable).where(eq(projectFilesTable.userId, userId));
  const allFiles = asFiles(fileRows);
  const concepts = asConcepts(map?.concepts);
  const eligibility = summarizeEligibility(concepts, allFiles);
  const attempts = await db.select().from(defenseSimulationsTable)
    .where(eq(defenseSimulationsTable.userId, userId))
    .orderBy(desc(defenseSimulationsTable.startedAt));
  const active = attempts.find((attempt) => attempt.status === "active");
  const completedScores = attempts.flatMap((attempt) =>
    attempt.status === "completed" && typeof attempt.overallScore === "number" ? [attempt.overallScore] : []);
  return {
    project_name: map?.projectName ?? null,
    tech_stack: map?.techStack ?? null,
    completed_concepts: eligibility.completedConcepts,
    total_concepts: concepts.length,
    average_mastery: eligibility.averageMastery,
    eligible: eligibility.eligible,
    warning: eligibility.warning,
    no_saved_files: publicFileCount(allFiles) === 0,
    completed_files: publicFileCount(allFiles),
    total_attempts: attempts.length,
    best_score: completedScores.length ? Math.max(...completedScores) : null,
    last_attempt_at: attempts[0]?.startedAt.toISOString() ?? null,
    latest_active: active ? toResponse(active) : null,
  };
}

export async function startDefense(userId: string, profile: { projectName: string | null; techStack: string | null }) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [active] = await tx.select().from(defenseSimulationsTable).where(and(
      eq(defenseSimulationsTable.userId, userId),
      eq(defenseSimulationsTable.status, "active"),
    )).limit(1);
    if (active) throw new DefenseServiceError("DEFENSE_ALREADY_ACTIVE");
    const [map] = await tx.select().from(learningMapsTable).where(eq(learningMapsTable.userId, userId)).limit(1);
    const concepts = asConcepts(map?.concepts);
    const fileRows = await tx.select({
      path: projectFilesTable.path,
      content: projectFilesTable.content,
      status: projectFilesTable.status,
      conceptNameEn: projectFilesTable.conceptNameEn,
    }).from(projectFilesTable).where(eq(projectFilesTable.userId, userId));
    const allFiles = asFiles(fileRows);
    const eligibility = summarizeEligibility(concepts, allFiles);
    if (!eligibility.eligible) {
      throw new DefenseServiceError(eligibility.warning ? `DEFENSE_NOT_ELIGIBLE:${eligibility.warning}` : "DEFENSE_NOT_ELIGIBLE");
    }
    const projectName = map?.projectName ?? profile.projectName;
    const techStack = map?.techStack ?? profile.techStack;
    if (!projectName || !techStack) throw new DefenseServiceError("DEFENSE_PROFILE_INCOMPLETE");
    const files = eligibility.savedFiles;
    const recentRows = await tx.select({ questions: defenseSimulationsTable.questions })
      .from(defenseSimulationsTable)
      .where(eq(defenseSimulationsTable.userId, userId))
      .orderBy(desc(defenseSimulationsTable.startedAt))
      .limit(5);
    const recentTemplateIds = new Set(recentRows.flatMap((attempt) =>
      ((attempt.questions as QuestionWithStart[]) ?? [])
        .flatMap((question) => question.template_id ? [question.template_id] : [])));
    const generated = await generateDefenseQuestions({ projectName, techStack, concepts, files, recentTemplateIds });
    if (generated.questions.length !== DEFENSE_QUESTION_COUNT) throw new DefenseServiceError("DEFENSE_QUESTION_SET_INVALID");
    const now = new Date();
    const currentStart = new Date(now.getTime() + DEFENSE_START_DELAY_MS);
    const [row] = await tx.insert(defenseSimulationsTable).values({
      userId,
      projectName,
      techStack,
      status: "active",
      source: generated.source,
      questions: generated.questions,
      currentIndex: 0,
      currentQuestionStartedAt: currentStart,
      deadlineAt: new Date(currentStart.getTime() + DEFENSE_QUESTION_SECONDS * 1_000),
      weakConcepts: [],
    }).returning();
    return toResponse(throwIfMissing(row), now);
  });
}

export async function saveDefenseDraft(userId: string, simulationId: string, questionNumber: number, draft: string) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const row = throwIfMissing(await ownedSimulation(tx, userId, simulationId, true));
    if (row.status !== "active" || questionNumber !== row.currentIndex + 1) {
      throw new DefenseServiceError("DEFENSE_QUESTION_NOT_CURRENT");
    }
    const questions = [...row.questions] as QuestionWithStart[];
    const question = throwIfMissing(questions[row.currentIndex], "DEFENSE_QUESTION_NOT_CURRENT");
    if (question.evaluation_status !== "unanswered" || question.student_answer !== null) {
      throw new DefenseServiceError("DEFENSE_ANSWER_LOCKED");
    }
    const now = new Date();
    if (row.deadlineAt && !canSaveDraftWithinGrace(row.deadlineAt, now)) {
      throw new DefenseServiceError("DEFENSE_DEADLINE_PASSED");
    }
    questions[row.currentIndex] = { ...question, draft };
    const [updated] = await tx.update(defenseSimulationsTable).set({
      questions,
      updatedAt: now,
    }).where(eq(defenseSimulationsTable.id, row.id)).returning();
    return toResponse(throwIfMissing(updated), now);
  });
}

type LockedSubmission = {
  row: DefenseSimulationRow;
  question: QuestionWithStart;
  answer: string;
  timeUsed: number;
  shouldEvaluate: boolean;
  claimToken: string;
};

export async function submitDefenseAnswer(
  userId: string,
  simulationId: string,
  questionNumber: number,
  submittedAnswer: string,
) {
  const now = new Date();
  const submission = await db.transaction(async (tx): Promise<LockedSubmission> => {
    await lockUser(tx, userId);
    const row = throwIfMissing(await ownedSimulation(tx, userId, simulationId, true));
    if (row.status !== "active" || questionNumber !== row.currentIndex + 1) {
      throw new DefenseServiceError("DEFENSE_QUESTION_NOT_CURRENT");
    }
    const questions = [...row.questions] as QuestionWithStart[];
    let question = throwIfMissing(questions[row.currentIndex], "DEFENSE_QUESTION_NOT_CURRENT");
    if (question.student_answer !== null) {
      if (!isIdenticalLockedAnswer(question.student_answer, submittedAnswer)) {
        throw new DefenseServiceError("DEFENSE_ANSWER_LOCKED");
      }
      if (question.evaluation_status === "scored") {
        return {
          row,
          question,
          answer: question.student_answer,
          timeUsed: question.time_used_seconds ?? 0,
          shouldEvaluate: false,
          claimToken: "",
        };
      }
      const claimAt = question.evaluation_started_at ? new Date(question.evaluation_started_at).getTime() : 0;
      if (question.evaluation_status === "pending" && now.getTime() - claimAt < 32_000) {
        return {
          row,
          question,
          answer: question.student_answer,
          timeUsed: question.time_used_seconds ?? 0,
          shouldEvaluate: false,
          claimToken: "",
        };
      }
    }
    const locked = getLockedAnswer(question, submittedAnswer, now, row.currentQuestionStartedAt, row.deadlineAt);
    const answer = locked.answer.slice(0, 12_000);
    const evaluationStartedAt = now.toISOString();
    const claimToken = randomUUID();
    question = {
      ...question,
      student_answer: answer,
      draft: answer,
      answered_at: question.answered_at ?? now.toISOString(),
      points: null,
      time_used_seconds: question.time_used_seconds ?? locked.timeUsed,
      evaluation_status: "pending",
      evaluation_started_at: evaluationStartedAt,
      evaluation_claim_token: claimToken,
    };
    questions[row.currentIndex] = question;
    const [updated] = await tx.update(defenseSimulationsTable).set({
      questions,
      updatedAt: now,
    }).where(eq(defenseSimulationsTable.id, row.id)).returning();
    const persisted = throwIfMissing(updated);
    return {
      row: persisted,
      question,
      answer,
      timeUsed: question.time_used_seconds ?? locked.timeUsed,
      shouldEvaluate: true,
      claimToken,
    };
  });

  if (!submission.shouldEvaluate) return toResponse(submission.row, new Date());

  try {
    const evaluation = await evaluateDefenseAnswer(submission.question, submission.answer, submission.timeUsed);
    return await db.transaction(async (tx) => {
      await lockUser(tx, userId);
      const row = throwIfMissing(await ownedSimulation(tx, userId, simulationId, true));
      if (row.status !== "active") return toResponse(row);
      const questions = [...row.questions] as QuestionWithStart[];
      const question = throwIfMissing(questions[questionNumber - 1], "DEFENSE_QUESTION_NOT_CURRENT");
      if (question.student_answer !== submission.answer || question.evaluation_status !== "pending"
        || !isCurrentEvaluationClaim(question, submission.claimToken)) return toResponse(row);
      questions[questionNumber - 1] = {
        ...question,
        points: evaluation.points,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        professor_reaction: evaluation.professor_reaction,
        mini_feedback: evaluation.mini_feedback,
        would_pass: evaluation.would_pass,
        evaluation_status: "scored",
        evaluation_started_at: null,
        evaluation_claim_token: null,
      };
      const [updated] = await tx.update(defenseSimulationsTable).set({ questions, updatedAt: new Date() })
        .where(eq(defenseSimulationsTable.id, row.id)).returning();
      return toResponse(throwIfMissing(updated));
    });
  } catch (error) {
    logger.warn({ simulation_id: simulationId, question_number: questionNumber, reason: error instanceof Error ? error.message : "evaluation_failed" },
      "Defense answer evaluation is unavailable; immutable answer remains saved");
    return db.transaction(async (tx) => {
      await lockUser(tx, userId);
      const row = throwIfMissing(await ownedSimulation(tx, userId, simulationId, true));
      if (row.status !== "active") return toResponse(row);
      const questions = [...row.questions] as QuestionWithStart[];
      const question = throwIfMissing(questions[questionNumber - 1], "DEFENSE_QUESTION_NOT_CURRENT");
      if (question.student_answer === submission.answer && question.evaluation_status === "pending"
        && isCurrentEvaluationClaim(question, submission.claimToken)) {
        questions[questionNumber - 1] = {
          ...question,
          evaluation_status: "failed",
          evaluation_started_at: null,
          evaluation_claim_token: null,
        };
        const [updated] = await tx.update(defenseSimulationsTable).set({ questions, updatedAt: new Date() })
          .where(eq(defenseSimulationsTable.id, row.id)).returning();
        return toResponse(throwIfMissing(updated));
      }
      return toResponse(row);
    });
  }
}

export async function advanceDefense(userId: string, simulationId: string) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const row = throwIfMissing(await ownedSimulation(tx, userId, simulationId, true));
    if (row.status !== "active") throw new DefenseServiceError("DEFENSE_NOT_ACTIVE");
    const current = row.questions[row.currentIndex] as QuestionWithStart | undefined;
    if (!current || current.evaluation_status !== "scored") throw new DefenseServiceError("DEFENSE_ANSWER_NOT_SCORED");
    if (row.currentIndex >= DEFENSE_QUESTION_COUNT - 1) throw new DefenseServiceError("DEFENSE_LAST_QUESTION");
    const now = new Date();
    const nextStart = new Date(now.getTime() + DEFENSE_START_DELAY_MS);
    const [updated] = await tx.update(defenseSimulationsTable).set({
      currentIndex: row.currentIndex + 1,
      currentQuestionStartedAt: nextStart,
      deadlineAt: new Date(nextStart.getTime() + DEFENSE_QUESTION_SECONDS * 1_000),
      updatedAt: now,
    }).where(eq(defenseSimulationsTable.id, row.id)).returning();
    return toResponse(throwIfMissing(updated), now);
  });
}

export async function completeDefense(userId: string, simulationId: string) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const row = throwIfMissing(await ownedSimulation(tx, userId, simulationId, true));
    if (row.status === "completed") return toResponse(row);
    if (row.status !== "active") throw new DefenseServiceError("DEFENSE_NOT_ACTIVE");
    const questions = row.questions as QuestionWithStart[];
    if (row.currentIndex !== DEFENSE_QUESTION_COUNT - 1
      || questions.length !== DEFENSE_QUESTION_COUNT
      || !questions.every((question) => question.answered_at !== null && question.evaluation_status === "scored")) {
      throw new DefenseServiceError("DEFENSE_NOT_FULLY_SCORED");
    }
    let aggregate: ReturnType<typeof aggregateDefense>;
    try {
      aggregate = aggregateDefense(questions);
    } catch {
      throw new DefenseServiceError("DEFENSE_NOT_FULLY_SCORED");
    }
    const now = new Date();
    const [updated] = await tx.update(defenseSimulationsTable).set({
      status: "completed",
      overallScore: aggregate.overallScore,
      verdict: aggregate.verdict,
      weakConcepts: aggregate.weakConcepts,
      completedAt: now,
      currentQuestionStartedAt: null,
      deadlineAt: null,
      updatedAt: now,
    }).where(eq(defenseSimulationsTable.id, row.id)).returning();
    return toResponse(throwIfMissing(updated), now);
  });
}

export async function abandonDefense(userId: string, simulationId: string) {
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const row = throwIfMissing(await ownedSimulation(tx, userId, simulationId, true));
    if (row.status === "abandoned") return toResponse(row);
    if (row.status !== "active") throw new DefenseServiceError("DEFENSE_NOT_ACTIVE");
    const now = new Date();
    const [updated] = await tx.update(defenseSimulationsTable).set({
      status: "abandoned",
      completedAt: now,
      currentQuestionStartedAt: null,
      deadlineAt: null,
      updatedAt: now,
    }).where(eq(defenseSimulationsTable.id, row.id)).returning();
    return toResponse(throwIfMissing(updated), now);
  });
}