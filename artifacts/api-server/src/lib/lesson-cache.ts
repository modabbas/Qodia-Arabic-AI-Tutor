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
};

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
): LessonCacheEntry | null {
  const ownedSessions = new Map(sessions
    .filter((session) => session.userId === userId && session.lessonId)
    .map((session) => [session.lessonId!, session]));
  return rows
    .filter((row) => row.userId === userId && payloadLessonId(row.payload))
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