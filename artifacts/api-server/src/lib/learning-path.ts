import type { ProjectPlanEntry } from "@workspace/db";

export type LearningStatus = "planned" | "in_progress" | "completed" | "needs_review";
export type LearningConcept = {
  id: string;
  name_en: string;
  name_ar: string;
  category: string;
  difficulty: number;
  prerequisites: string[];
  planned_day: number;
  target_file: string;
  why_important: string;
  status: LearningStatus;
  mastery_score: number | null;
  last_reviewed: string | null;
  session_id: string | null;
  encounter_count?: number;
};

export type CurriculumConceptInput = Omit<
  LearningConcept,
  "status" | "mastery_score" | "last_reviewed" | "session_id" | "encounter_count"
>;

export type HistoricalConcept = {
  concept: string;
  sessionId: string;
  timestamp: Date;
  touchesCompleted: number;
  masteryEarned?: number | null;
};

export type CompletedProjectFileConcept = {
  path: string;
  nameEn: string;
  completedSessionId: string | null;
  updatedAt: Date;
};

export type SelectedConcept = {
  concept: LearningConcept;
  isReview: boolean;
  reviewReason?: string;
};

export function normalizeConceptName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "");
}

export function lessonExclusionNames(
  historicalConceptNames: string[],
  completedConceptNames: string[],
  previousConceptNames: string[],
  selectedConceptName: string,
): string[] {
  const selected = normalizeConceptName(selectedConceptName);
  const names = new Map<string, string>();
  for (const value of [...historicalConceptNames, ...completedConceptNames, ...previousConceptNames]) {
    const name = value.trim();
    const normalized = normalizeConceptName(name);
    if (normalized && normalized !== selected && !names.has(normalized)) names.set(normalized, name);
  }
  return [...names.values()];
}

export function completedProjectFileConcepts(
  userId: string,
  planFiles: ProjectPlanEntry[],
  projectFiles: {
    userId: string;
    path: string;
    conceptNameEn: string;
    status: string;
    completedSessionId: string | null;
    updatedAt: Date;
  }[],
): CompletedProjectFileConcept[] {
  const planByPath = new Map(planFiles.map((file) => [file.path, file]));
  const completed = projectFiles
    .filter((file) => file.userId === userId && file.status === "complete" && planByPath.has(file.path))
    .map((file) => ({
      path: file.path,
      nameEn: file.conceptNameEn.trim(),
      completedSessionId: file.completedSessionId,
      updatedAt: file.updatedAt,
    }))
    .sort((left, right) => planByPath.get(left.path)!.day - planByPath.get(right.path)!.day);
  const names = new Set<string>();
  for (const file of completed) {
    const normalized = normalizeConceptName(file.nameEn);
    if (!normalized || names.has(normalized)) {
      throw new Error("Completed owned project files contain duplicate or invalid lesson concept names");
    }
    names.add(normalized);
  }
  return completed;
}

export function validateCurriculum(
  value: unknown,
  planFiles: ProjectPlanEntry[],
  completedFiles: CompletedProjectFileConcept[] = [],
): CurriculumConceptInput[] {
  if (!Array.isArray(value) || value.length !== 30 || planFiles.length !== 30) {
    throw new Error("Learning map must include exactly 30 concepts and match the 30-file project plan");
  }
  const files = new Set(planFiles.map((file) => file.path));
  const ids = new Set<string>();
  const names = new Set<string>();
  const days = new Set<number>();
  const targetFiles = new Set<string>();
  const concepts = value.map((raw): CurriculumConceptInput => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Learning concept must be an object");
    const item = raw as Record<string, unknown>;
    const requiredString = (key: string, max: number): string => {
      const result = item[key];
      if (typeof result !== "string" || !result.trim() || result.trim().length > max) {
        throw new Error(`Learning concept ${key} is invalid`);
      }
      return result.trim();
    };
    const id = requiredString("id", 100);
    const nameEn = requiredString("name_en", 100);
    const nameAr = requiredString("name_ar", 140);
    const category = requiredString("category", 80);
    const targetFile = requiredString("target_file", 240);
    const whyImportant = requiredString("why_important", 500);
    const difficulty = item.difficulty;
    const plannedDay = item.planned_day;
    const prerequisites = item.prerequisites;
    if (!Number.isInteger(difficulty) || Number(difficulty) < 1 || Number(difficulty) > 5) {
      throw new Error("Learning concept difficulty must be an integer from 1 through 5");
    }
    if (!Number.isInteger(plannedDay) || Number(plannedDay) < 1 || Number(plannedDay) > 30) {
      throw new Error("Learning concept planned_day must be from 1 through 30");
    }
    if (!Array.isArray(prerequisites) || prerequisites.some((id) => typeof id !== "string" || !id.trim())) {
      throw new Error("Learning concept prerequisites must be concept IDs");
    }
    const normalizedId = id.toLocaleLowerCase("en");
    const normalizedName = normalizeConceptName(nameEn);
    if (!normalizedName || ids.has(normalizedId) || names.has(normalizedName) || days.has(Number(plannedDay))) {
      throw new Error("Learning concept IDs, normalized names, and planned days must be unique");
    }
    if (!files.has(targetFile) || targetFiles.has(targetFile)) {
      throw new Error("Learning concept target_file must uniquely match an existing project-plan path");
    }
    ids.add(normalizedId);
    names.add(normalizedName);
    days.add(Number(plannedDay));
    targetFiles.add(targetFile);
    return {
      id,
      name_en: nameEn,
      name_ar: nameAr,
      category,
      difficulty: Number(difficulty),
      prerequisites: prerequisites.map((id) => id.trim()),
      planned_day: Number(plannedDay),
      target_file: targetFile,
      why_important: whyImportant,
    };
  }).sort((left, right) => left.planned_day - right.planned_day);

  if (
    days.size !== 30
    || targetFiles.size !== 30
    || [...files].some((path) => !targetFiles.has(path))
    || concepts.some((concept, index) => concept.planned_day !== index + 1)
  ) {
    throw new Error("Learning map planned_day values must cover 1 through 30");
  }
  for (const completedFile of completedFiles) {
    const reserved = concepts.find((concept) => concept.target_file === completedFile.path);
    if (!reserved || reserved.name_en !== completedFile.nameEn) {
      throw new Error(`Curriculum must preserve the completed saved lesson name and path for ${completedFile.path}`);
    }
  }
  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  for (const concept of concepts) {
    if (new Set(concept.prerequisites).size !== concept.prerequisites.length) {
      throw new Error(`Learning concept ${concept.id} has duplicate prerequisites`);
    }
    for (const prerequisiteId of concept.prerequisites) {
      const prerequisite = byId.get(prerequisiteId);
      if (!prerequisite || prerequisite.planned_day >= concept.planned_day) {
        throw new Error(`Learning concept ${concept.id} has an unknown or non-earlier prerequisite`);
      }
    }
  }
  return concepts;
}

export function seedHistoricalConcepts(
  concepts: CurriculumConceptInput[],
  history: HistoricalConcept[],
  completedFiles: CompletedProjectFileConcept[] = [],
): LearningConcept[] {
  const completedHistory = history.filter((session) => session.touchesCompleted === 5)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime() || a.sessionId.localeCompare(b.sessionId));
  const historyByName = new Map<string, HistoricalConcept>();
  for (const session of completedHistory) {
    const englishName = session.concept.split(" — ", 1)[0]?.trim() ?? session.concept.trim();
    const normalized = normalizeConceptName(englishName);
    if (normalized && !historyByName.has(normalized)) historyByName.set(normalized, session);
  }
  const historyById = new Map(completedHistory.map((session) => [session.sessionId, session]));
  const completedFilesByPath = new Map(completedFiles.map((file) => [file.path, file]));
  return concepts.map((concept) => {
    const savedFile = completedFilesByPath.get(concept.target_file);
    if (savedFile && savedFile.nameEn !== concept.name_en) {
      throw new Error(`Completed saved file concept does not match curriculum at ${savedFile.path}`);
    }
    const linkedSession = savedFile?.completedSessionId
      ? historyById.get(savedFile.completedSessionId)
      : undefined;
    const historical = linkedSession
      && normalizeConceptName(linkedSession.concept.split(" — ", 1)[0]?.trim() ?? linkedSession.concept.trim())
        === normalizeConceptName(concept.name_en)
      ? linkedSession
      : historyByName.get(normalizeConceptName(concept.name_en));
    const isCompleted = Boolean(savedFile || historical);
    const masteryScore = isCompleted ? historical?.masteryEarned ?? 75 : null;
    return {
      ...concept,
      status: masteryScore === null ? "planned" : masteryScore >= 70 ? "completed" : "needs_review",
      mastery_score: masteryScore,
      last_reviewed: historical?.timestamp.toISOString() ?? (savedFile?.updatedAt.toISOString() ?? null),
      session_id: historical?.sessionId ?? null,
      encounter_count: Math.max(isCompleted ? 1 : 0, new Set(completedHistory
        .filter(session => normalizeConceptName(session.concept.split(" — ", 1)[0] ?? session.concept) === normalizeConceptName(concept.name_en))
        .map(session => session.sessionId)).size),
    };
  });
}

export function reconcileHistoricalConcepts(
  concepts: LearningConcept[],
  history: HistoricalConcept[],
  completedFiles: CompletedProjectFileConcept[],
): LearningConcept[] {
  const validated = validateCompletedFileBindings(concepts, completedFiles);
  const historical = seedHistoricalConcepts(
    concepts.map((concept) => ({
      id: concept.id,
      name_en: concept.name_en,
      name_ar: concept.name_ar,
      category: concept.category,
      difficulty: concept.difficulty,
      prerequisites: concept.prerequisites,
      planned_day: concept.planned_day,
      target_file: concept.target_file,
      why_important: concept.why_important,
    })),
    history,
    validated,
  );
  const completedHistory = history.filter((session) => session.touchesCompleted === 5);
  const historyById = new Map(completedHistory.map((session) => [session.sessionId, session]));
  const completedNames = new Map<string, HistoricalConcept>();
  for (const session of [...completedHistory].sort((a, b) => (
    b.timestamp.getTime() - a.timestamp.getTime() || a.sessionId.localeCompare(b.sessionId)
  ))) {
    const name = normalizeConceptName(session.concept.split(" — ", 1)[0]?.trim() ?? session.concept.trim());
    if (name && !completedNames.has(name)) completedNames.set(name, session);
  }
  return historical.map((concept, index) => {
    const previous = concepts[index]!;
    const completeFile = validated.find((file) => file.path === concept.target_file);
    const completedSession = completedNames.get(normalizeConceptName(concept.name_en));
    if (completeFile || completedSession) {
      const linked = completeFile?.completedSessionId
        ? historyById.get(completeFile.completedSessionId)
        : undefined;
      const linkedFileSession = linked
        && normalizeConceptName(linked.concept.split(" — ", 1)[0]?.trim() ?? linked.concept.trim())
          === normalizeConceptName(concept.name_en)
        ? linked
        : undefined;
      const authoritative = completedSession ?? linkedFileSession;
      const score = authoritative?.masteryEarned ?? 75;
      return {
        ...concept,
        status: score >= 70 ? "completed" : "needs_review",
        mastery_score: score,
        last_reviewed: authoritative?.timestamp.toISOString()
          ?? completeFile?.updatedAt.toISOString()
          ?? concept.last_reviewed,
        session_id: authoritative?.sessionId ?? null,
      };
    }
    const priorSession = previous.session_id ? historyById.get(previous.session_id) : undefined;
    if (previous.status === "completed" || previous.status === "needs_review") {
      if (!priorSession) {
        return {
          ...concept,
          status: "planned",
          mastery_score: null,
          last_reviewed: null,
          session_id: null,
        };
      }
    }
    if (previous.status === "in_progress") {
      return { ...concept, status: "in_progress", mastery_score: null, last_reviewed: null, session_id: null };
    }
    return concept;
  });
}

function validateCompletedFileBindings(
  concepts: LearningConcept[],
  completedFiles: CompletedProjectFileConcept[],
): CompletedProjectFileConcept[] {
  for (const file of completedFiles) {
    const concept = concepts.find((item) => item.target_file === file.path);
    if (!concept || concept.name_en !== file.nameEn) {
      throw new Error(`Existing learning map does not match the owned completed file ${file.path}`);
    }
  }
  return completedFiles;
}

function prerequisiteReadiness(concept: LearningConcept, concepts: LearningConcept[]): {
  eligible: boolean;
  lowMasteryBlocked: LearningConcept[];
} {
  const lowMasteryBlocked: LearningConcept[] = [];
  for (const id of concept.prerequisites) {
    const prerequisite = concepts.find((item) => item.id === id);
    if (!prerequisite || prerequisite.status !== "completed" || (prerequisite.mastery_score ?? 0) < 70) {
      if (
        prerequisite
        && (prerequisite.status === "needs_review" || prerequisite.status === "completed")
        && prerequisite.mastery_score !== null
        && prerequisite.mastery_score < 70
      ) lowMasteryBlocked.push(prerequisite);
      return { eligible: false, lowMasteryBlocked };
    }
  }
  return { eligible: true, lowMasteryBlocked };
}

export function selectNextConcept(
  concepts: LearningConcept[],
  now: Date,
  earlyReviewConceptIds: Set<string> = new Set(),
): SelectedConcept | null {
  const inProgress = concepts.find((concept) => concept.status === "in_progress");
  if (inProgress) return { concept: inProgress, isReview: false };

  const dueReviews = concepts
    .filter((concept) => (concept.status === "needs_review" || concept.status === "completed")
      && concept.mastery_score !== null
      && concept.mastery_score < 70)
    .filter((concept) => {
      if (earlyReviewConceptIds.has(concept.id)) return false;
      if (!concept.last_reviewed) return true;
      return now.getTime() - new Date(concept.last_reviewed).getTime() >= 3 * 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => {
      const first = a.last_reviewed ? new Date(a.last_reviewed).getTime() : 0;
      const second = b.last_reviewed ? new Date(b.last_reviewed).getTime() : 0;
      return first - second || a.planned_day - b.planned_day;
    });
  if (dueReviews[0]) return { concept: dueReviews[0], isReview: true, reviewReason: "مراجعة متباعدة لمفهوم إتقانه أقل من ٧٠٪." };

  const planned = concepts.filter((concept) => concept.status === "planned")
    .sort((a, b) => a.planned_day - b.planned_day);
  for (const concept of planned) {
    if (prerequisiteReadiness(concept, concepts).eligible) return { concept, isReview: false };
  }

  const blocked = planned.flatMap((concept) => prerequisiteReadiness(concept, concepts).lowMasteryBlocked);
  const uniqueBlocked = [...new Map(blocked.map((concept) => [concept.id, concept])).values()]
    .filter((concept) => !earlyReviewConceptIds.has(concept.id))
    .sort((a, b) => {
      const first = a.last_reviewed ? new Date(a.last_reviewed).getTime() : 0;
      const second = b.last_reviewed ? new Date(b.last_reviewed).getTime() : 0;
      return first - second || a.planned_day - b.planned_day;
    });
  if (uniqueBlocked[0]) {
    return {
      concept: uniqueBlocked[0],
      isReview: true,
      reviewReason: "مراجعة تعزيز مبكرة لأن إتقان هذا المتطلب يمنع فتح مفاهيم الخطة التالية.",
    };
  }
  return null;
}

export function calculateMasteryScore(
  touchesCorrect: number,
  completionTimeMinutes: number,
  buildPassed: boolean,
): number {
  const boundedTouches = Math.max(0, Math.min(5, Math.floor(touchesCorrect)));
  const speedBonus = completionTimeMinutes >= 0 && completionTimeMinutes < 10 ? 5 : 0;
  return Math.min(100, boundedTouches * 20 + speedBonus + (buildPassed ? 10 : 0));
}

export function conservativeLegacyTouchesCorrect(touchesCompleted: number, mistakes: number): number {
  return Math.max(0, Math.min(5, Math.floor(touchesCompleted) - Math.max(1, Math.floor(mistakes))));
}