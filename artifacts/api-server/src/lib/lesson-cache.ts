import { matchesHistoricalConcept, selectNextConcept, type LearningConcept } from "./learning-path.ts";

type LessonCacheEntry = {
  userId: string;
  sessionDate: string;
  payload: unknown;
  updatedAt: Date;
};

type LessonProgress = {
  userId: string;
  lessonId: string | null;
  touchesCompleted: number;
  conceptId?: string | null;
  concept?: string;
};

function isCompletedTeachingLesson(payload: unknown, sessions: LessonProgress[], concepts: LearningConcept[]): boolean {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const data = payload as Record<string, unknown>;
  if (data.is_review === true || typeof data.concept_id !== "string" || typeof data.concept_name_en !== "string") return false;
  const concept = { id: data.concept_id, name_en: data.concept_name_en };
  return concepts.some(item => item.id === concept.id && (item.status === "completed" || item.status === "needs_review"))
    || sessions.some(session => session.touchesCompleted >= 5 && typeof session.concept === "string"
      && matchesHistoricalConcept({ concept: session.concept, conceptId: session.conceptId }, concept));
}

export function isSupersededEarlyReview(payload: unknown, concepts: LearningConcept[], now: Date, hasStudentWork: boolean): boolean {
  if (hasStudentWork || !payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const data = payload as Record<string, unknown>;
  if (data.is_review !== true || typeof data.review_reason !== "string"
    || !data.review_reason.startsWith("مراجعة تعزيز مبكرة")) return false;
  const next = selectNextConcept(concepts, now);
  return !!next && !next.isReview;
}

export function additionalXpForProgress(previousXp: number, earnedXp: number): number {
  return Math.max(0, earnedXp - previousXp);
}

function payloadLessonId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const lessonId = (payload as Record<string, unknown>).lesson_id;
  return typeof lessonId === "string" ? lessonId : null;
}

export function findOwnedGeneratedLesson(
  rows: LessonCacheEntry[],
  userId: string,
  lessonId: string,
): LessonCacheEntry | null {
  return rows
    .filter((row) => row.userId === userId && payloadLessonId(row.payload) === lessonId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null;
}

export function findOwnedUnfinishedLessonById(
  rows: LessonCacheEntry[],
  sessions: LessonProgress[],
  userId: string,
  lessonId: string,
): LessonCacheEntry | null {
  const row = findOwnedGeneratedLesson(rows, userId, lessonId);
  if (!row) return null;
  const session = sessions.find((item) => item.userId === userId && item.lessonId === lessonId);
  return session && session.touchesCompleted >= 5 ? null : row;
}

export function selectOwnedUnfinishedLesson(
  rows: LessonCacheEntry[],
  sessions: LessonProgress[],
  userId: string,
  concepts: LearningConcept[] = [],
): LessonCacheEntry | null {
  const ownedSessions = new Map(sessions
    .filter((session) => session.userId === userId && session.lessonId)
    .map((session) => [session.lessonId!, session]));
  return rows
    .filter((row) => row.userId === userId && payloadLessonId(row.payload))
    .filter(row => !isCompletedTeachingLesson(row.payload, sessions.filter(session => session.userId === userId), concepts))
    .map((row) => ({
      row,
      session: ownedSessions.get(payloadLessonId(row.payload)!),
    }))
    .filter(({ session }) => !session || session.touchesCompleted < 5)
    .sort((a, b) => {
      const aProgress = a.session?.touchesCompleted ?? -1;
      const bProgress = b.session?.touchesCompleted ?? -1;
      return bProgress - aProgress || b.row.updatedAt.getTime() - a.row.updatedAt.getTime();
    })[0]?.row ?? null;
}