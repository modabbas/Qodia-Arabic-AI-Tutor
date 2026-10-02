import { Router, type IRouter } from "express";
import { GetGeneratedSessionResponse } from "@workspace/api-zod";
import { validateStudentCode } from "../lib/student-code-validation";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  generatedSessionsTable,
  learningMapsTable,
  lessonSubmissionsTable,
  progressTable,
  projectFilesTable,
  reviewExercisesTable,
  sessionsTable,
  touch4SupportTable,
  usersTable,
  type LearningSession,
} from "@workspace/db";
import {
  CompleteOnboardingBody,
  CompleteOnboardingResponse,
  CreateSessionBody,
  CreateSessionResponse,
  GetDashboardResponse,
  GetProjectStructureResponse,
  GetSessionsResponse,
  SaveProjectFileBody,
  SaveProjectFileResponse,
} from "@workspace/api-zod";
import { publicUser, requireUser } from "../lib/qodia-auth";
import {
  ensureProjectPlan,
  getProjectStructureData,
  isProjectTechStack,
} from "../lib/project-builder";
import { assembleProject, verifyProject, verifySubmittedFile, zipProject } from "../lib/project-export";
import { GetProjectVerificationResponse } from "@workspace/api-zod";
import { ensureLearningMap } from "../lib/learning-map-service";
import {
  additionalXpForProgress,
  findOwnedGeneratedLesson,
  findOwnedUnfinishedLessonById,
  selectOwnedUnfinishedLesson,
} from "../lib/lesson-cache";
import {
  calculateMasteryScore,
  conservativeLegacyTouchesCorrect,
  normalizeConceptName,
} from "../lib/learning-path";
import {
  recordTouch4Failure,
  recordTouch4SuccessfulSave,
  reserveTouch4Attempt,
} from "../lib/touch4-support";
import { touch4SessionXp, touch4XpPenalty, xpDeltaForSession } from "../lib/touch4-support-rules";

const router: IRouter = Router();

function sessionResponse(session: LearningSession) {
  return {
    id: session.id,
    user_id: session.userId,
    concept: session.concept,
    touches_completed: session.touchesCompleted,
    mistakes: session.mistakes,
    xp_earned: session.xpEarned,
    timestamp: session.timestamp.toISOString(),
    concept_id: session.conceptId,
    mastery_earned: session.masteryEarned,
    touches_correct: session.touchesCorrect,
    completion_time: session.completionTime,
    is_review: session.isReview,
  };
}

function dayInDamascus(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Damascus",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (part: string) => parts.find((item) => item.type === part)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

type CachedLesson = {
  conceptNameEn: string;
  conceptNameAr: string;
  conceptId?: string;
  lessonId?: string;
  isReview: boolean;
  reviewReason?: string;
  legacy: boolean;
  targetFile?: string;
  fileAction?: "create" | "modify";
  existingContent?: string;
};

function cachedLesson(payload: unknown): CachedLesson | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const session = payload as Record<string, unknown>;
  if (typeof session.concept_name_en !== "string" || typeof session.concept_name_ar !== "string") return null;
  const touch4 = session.touch4_build;
  if (!touch4 || typeof touch4 !== "object" || Array.isArray(touch4)) return null;
  const build = touch4 as Record<string, unknown>;
  const hasTargetFile = Object.prototype.hasOwnProperty.call(build, "target_file");
  const hasFileAction = Object.prototype.hasOwnProperty.call(build, "file_action");
  if (!hasTargetFile && !hasFileAction) {
    return {
      conceptNameEn: session.concept_name_en,
      conceptNameAr: session.concept_name_ar,
      conceptId: typeof session.concept_id === "string" ? session.concept_id : undefined,
      lessonId: typeof session.lesson_id === "string" ? session.lesson_id : undefined,
      isReview: session.is_review === true,
      reviewReason: typeof session.review_reason === "string" ? session.review_reason : undefined,
      legacy: true,
    };
  }
  if (
    typeof build.target_file !== "string"
    || (build.file_action !== "create" && build.file_action !== "modify")
    || typeof build.existing_content !== "string"
  ) return null;
  return {
    conceptNameEn: session.concept_name_en,
    conceptNameAr: session.concept_name_ar,
    conceptId: typeof session.concept_id === "string" ? session.concept_id : undefined,
    lessonId: typeof session.lesson_id === "string" ? session.lesson_id : undefined,
    isReview: session.is_review === true,
    reviewReason: typeof session.review_reason === "string" ? session.review_reason : undefined,
    legacy: false,
    targetFile: build.target_file,
    fileAction: build.file_action,
    existingContent: build.existing_content,
  };
}

function appendOnlyExtension(previous: string, next: string): boolean {
  return next === previous
    || next.startsWith(`${previous}\r\n`)
    || next.startsWith(`${previous}\n`);
}

router.patch("/onboarding", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const parsed = CompleteOnboardingBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.project_name.trim()) {
    res.status(400).json({ error: "أدخل اسم المشروع واختر التقنية." });
    return;
  }

  const [updated] = await db.update(usersTable).set({
    projectName: parsed.data.project_name.trim(),
    techStack: parsed.data.tech_stack,
  }).where(eq(usersTable.id, user.id)).returning();
  if (updated?.projectName && isProjectTechStack(updated.techStack)) {
    try {
      await ensureProjectPlan(updated.id, updated.projectName, updated.techStack, req);
    } catch {
      req.log.error({ reason: "plan_creation_failed" }, "Project plan creation failed after onboarding");
      res.status(500).json({ error: "تعذر إنشاء خطة المشروع حالياً. أعد المحاولة لاحقاً." });
      return;
    }
    try {
      await ensureLearningMap(updated.id, updated.projectName, updated.techStack, req);
    } catch (error) {
      req.log.warn({ reason: error instanceof Error ? error.message : "learning_map_unavailable" }, "Onboarding saved; learning map will retry on access");
    }
  }
  res.json(CompleteOnboardingResponse.parse(publicUser(updated)));
});

router.get("/project-structure", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!user.projectName?.trim() || !isProjectTechStack(user.techStack)) {
    res.status(400).json({ error: "أكمل اسم المشروع واختر التقنية من ملفك الشخصي أولاً." });
    return;
  }
  const structure = await getProjectStructureData(user.id, user.projectName, user.techStack, req);
  res.json(GetProjectStructureResponse.parse(structure));
});

async function projectSource(userId: string) {
  const saved = await db.select({
    path: projectFilesTable.path,
    content: projectFilesTable.content,
  }).from(projectFilesTable).where(eq(projectFilesTable.userId, userId));
  return saved;
}

router.get("/project-verification", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!user.projectName?.trim() || !isProjectTechStack(user.techStack)) {
    res.status(400).json({ error: "أكمل اسم المشروع واختر التقنية أولاً." });
    return;
  }
  const files = await projectSource(user.id);
  const report = await verifyProject(files, user.techStack);
  res.setHeader("Cache-Control", "no-store");
  res.json(GetProjectVerificationResponse.parse(report));
});

router.get("/project-export", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!user.projectName?.trim() || !isProjectTechStack(user.techStack)) {
    res.status(400).json({ error: "أكمل اسم المشروع واختر التقنية أولاً." });
    return;
  }
  const files = await projectSource(user.id);
  if (!files.length) {
    res.status(409).json({ error: "احفظ أول ملف في مشروعك قبل تنزيله." });
    return;
  }
  try {
    const assembled = assembleProject(files, user.techStack, user.projectName);
    const zip = zipProject(assembled);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="kodia-project.zip"');
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(zip);
  } catch (error) {
    req.log.error({ reason: error instanceof Error ? error.message : "export_failed" }, "Project export failed");
    res.status(422).json({ error: "تعذر تجهيز الملفات المحفوظة للتنزيل. راجع ملفات مشروعك وحاول لاحقاً." });
  }
});

router.post("/save-file", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = SaveProjectFileBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.file_path.trim() || !parsed.data.concept_name_en.trim()
    || Buffer.byteLength(parsed.data.content, "utf8") > 30_720) {
    res.status(400).json({ error: "مسار الملف أو محتواه غير صالح." });
    return;
  }
  if (!user.projectName?.trim() || !isProjectTechStack(user.techStack)) {
    res.status(400).json({ error: "أكمل اسم المشروع واختر التقنية من ملفك الشخصي أولاً." });
    return;
  }

  const plan = await ensureProjectPlan(user.id, user.projectName, user.techStack, req);
  const planned = plan.files.find((file) => file.path === parsed.data.file_path);
  if (!planned) {
    res.status(400).json({ error: "هذا المسار غير موجود في خطة المشروع." });
    return;
  }
  // Validate before opening the save transaction; never hold row locks while
  // waiting on Gemini. Recheck ownership/lesson identity inside the transaction.
  const validationCaches = await db.select().from(generatedSessionsTable)
    .where(eq(generatedSessionsTable.userId, user.id))
    .orderBy(desc(generatedSessionsTable.updatedAt));
  const validationProgress = await db.select({
    userId: sessionsTable.userId,
    lessonId: sessionsTable.lessonId,
    touchesCompleted: sessionsTable.touchesCompleted,
  }).from(sessionsTable).where(eq(sessionsTable.userId, user.id));
  const validationCache = parsed.data.lesson_id
    ? findOwnedUnfinishedLessonById(validationCaches, validationProgress, user.id, parsed.data.lesson_id)
    : selectOwnedUnfinishedLesson(validationCaches, validationProgress, user.id);
  const ownedSession = GetGeneratedSessionResponse.safeParse(validationCache?.payload);
  if (!ownedSession.success || !ownedSession.data.lesson_id
    || ownedSession.data.concept_name_en !== parsed.data.concept_name_en
    || ownedSession.data.touch4_build.target_file !== parsed.data.file_path) {
    res.status(409).json({ error: "المهمة تغيرت أو اكتملت. أعد تحميل جلستك قبل ما تحفظ." });
    return;
  }
  req.log.info({
    step: "touch4_attempt", concept_id: ownedSession.data.concept_id,
    attempt_number: parsed.data.attempt_number ?? null,
  }, "Student submitted code for progressive validation");
  const reservedAttemptIndex = await reserveTouch4Attempt(
    user.id,
    ownedSession.data.lesson_id,
    validationCache?.payload,
  );
  if (reservedAttemptIndex === null) {
    res.status(409).json({ error: "المهمة تغيرت أو اكتملت. أعد تحميل جلستك قبل ما تحفظ." });
    return;
  }
  const buildValidation = await validateStudentCode({
    code: parsed.data.content,
    techStack: user.techStack,
    concept: ownedSession.data.concept_name_en,
    task: ownedSession.data.touch4_build,
  }, req);
  if (!buildValidation.valid) {
    try {
      await recordTouch4Failure(
        user.id,
        ownedSession.data.lesson_id,
        reservedAttemptIndex,
        validationCache?.payload,
      );
    } catch {
      req.log.warn({
        lesson_id: ownedSession.data.lesson_id,
        reason: "touch4_attempt_persistence_failed",
      }, "Validation result preserved, but Touch 4 failure progress could not be persisted");
    }
    res.status(422).json({ error: buildValidation.feedback_ar, validation: buildValidation });
    return;
  }
  let result: {
    content: string;
    status: "complete" | "in_progress" | "planned";
    sessionId: string | null;
    isReview: boolean;
  };
  try {
    result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id})::bigint)`);
      const cacheRows = await tx.select().from(generatedSessionsTable)
        .where(eq(generatedSessionsTable.userId, user.id))
        .orderBy(desc(generatedSessionsTable.updatedAt))
        .for("update");
      const lessonProgress = await tx.select({
        userId: sessionsTable.userId,
        lessonId: sessionsTable.lessonId,
        touchesCompleted: sessionsTable.touchesCompleted,
      }).from(sessionsTable).where(eq(sessionsTable.userId, user.id));
      const activeCache = parsed.data.lesson_id
        ? findOwnedUnfinishedLessonById(cacheRows, lessonProgress, user.id, parsed.data.lesson_id)
        : selectOwnedUnfinishedLesson(cacheRows, lessonProgress, user.id);
      const lesson = cachedLesson(activeCache?.payload);
      if (
        !lesson
        || lesson.legacy
        || !lesson.conceptId
        || !lesson.lessonId
        || lesson.targetFile !== parsed.data.file_path
        || lesson.conceptNameEn !== parsed.data.concept_name_en
        || lesson.lessonId !== ownedSession.data.lesson_id
        || JSON.stringify(activeCache?.payload) !== JSON.stringify(validationCache?.payload)
      ) throw new Error("PROJECT_FILE_CONFLICT");

      const [map] = await tx.select().from(learningMapsTable)
        .where(eq(learningMapsTable.userId, user.id)).limit(1).for("update");
      const concept = map?.concepts.find((entry) => entry.id === lesson.conceptId);
      if (!concept || concept.name_en !== lesson.conceptNameEn || concept.target_file !== parsed.data.file_path) {
        throw new Error("PROJECT_FILE_CONFLICT");
      }

      let [existing] = await tx.select().from(projectFilesTable).where(and(
        eq(projectFilesTable.userId, user.id),
        eq(projectFilesTable.path, planned.path),
      )).limit(1).for("update");

      if (lesson.isReview) {
        const [reviewDraft] = await tx.select().from(reviewExercisesTable).where(and(
          eq(reviewExercisesTable.userId, user.id),
          eq(reviewExercisesTable.lessonId, lesson.lessonId),
        )).limit(1).for("update");
        if (reviewDraft && (
          reviewDraft.conceptId !== lesson.conceptId
          || reviewDraft.targetFile !== planned.path
          || !appendOnlyExtension(reviewDraft.content, parsed.data.content)
        )) throw new Error("PROJECT_FILE_CONFLICT");
        if (reviewDraft) {
          await tx.update(reviewExercisesTable).set({
            content: parsed.data.content,
            updatedAt: new Date(),
          }).where(eq(reviewExercisesTable.id, reviewDraft.id));
        } else {
          await tx.insert(reviewExercisesTable).values({
            userId: user.id,
            lessonId: lesson.lessonId,
            conceptId: lesson.conceptId,
            targetFile: planned.path,
            content: parsed.data.content,
          });
        }
        const [submission] = await tx.select().from(lessonSubmissionsTable).where(and(
          eq(lessonSubmissionsTable.userId, user.id),
          eq(lessonSubmissionsTable.lessonId, lesson.lessonId),
        )).limit(1).for("update");
        if (submission) {
          if (submission.isReview !== true || submission.targetFile !== planned.path) throw new Error("PROJECT_FILE_CONFLICT");
          await tx.update(lessonSubmissionsTable).set({
            submissionCount: submission.submissionCount + 1,
            updatedAt: new Date(),
          }).where(eq(lessonSubmissionsTable.id, submission.id));
        } else {
          const firstAttemptPassed = await verifySubmittedFile(planned.path, parsed.data.content, user.techStack as Parameters<typeof verifyProject>[1]);
          await tx.insert(lessonSubmissionsTable).values({
            userId: user.id,
            lessonId: lesson.lessonId,
            targetFile: planned.path,
            isReview: true,
            firstAttemptPassed,
          });
        }
        await recordTouch4SuccessfulSave(
          tx,
          user.id,
          lesson.lessonId,
          reservedAttemptIndex,
          Boolean(submission || reviewDraft),
        );
        return {
          content: parsed.data.content,
          status: existing?.status ?? "planned",
          sessionId: existing?.completedSessionId ?? null,
          isReview: true,
        };
      }

      if (!existing) {
        if (lesson.fileAction !== "create" || lesson.existingContent !== "") {
          throw new Error("PROJECT_FILE_CONFLICT");
        }
        const [inserted] = await tx.insert(projectFilesTable).values({
          userId: user.id,
          path: planned.path,
          content: parsed.data.content,
          conceptNameEn: lesson.conceptNameEn,
          status: "in_progress",
        }).onConflictDoNothing().returning();
        if (inserted) {
          const source = await tx.select({ path: projectFilesTable.path, content: projectFilesTable.content })
            .from(projectFilesTable).where(eq(projectFilesTable.userId, user.id));
          const candidateFiles = source.map((file) => file.path === planned.path
            ? { path: file.path, content: parsed.data.content }
            : file);
          const verification = await verifyProject(candidateFiles, user.techStack as Parameters<typeof verifyProject>[1]);
          const [submission] = await tx.select().from(lessonSubmissionsTable).where(and(
            eq(lessonSubmissionsTable.userId, user.id),
            eq(lessonSubmissionsTable.lessonId, lesson.lessonId),
          )).limit(1).for("update");
          if (!submission) await tx.insert(lessonSubmissionsTable).values({
            userId: user.id,
            lessonId: lesson.lessonId,
            targetFile: planned.path,
            isReview: false,
            firstAttemptPassed: verification.status === "passed",
          });
          await recordTouch4SuccessfulSave(
            tx,
            user.id,
            lesson.lessonId,
            reservedAttemptIndex,
            Boolean(submission),
          );
          return { content: inserted.content, status: inserted.status, sessionId: inserted.completedSessionId, isReview: false };
        }
        [existing] = await tx.select().from(projectFilesTable).where(and(
          eq(projectFilesTable.userId, user.id),
          eq(projectFilesTable.path, planned.path),
        )).limit(1).for("update");
      }
      if (!existing || existing.status === "complete") throw new Error("PROJECT_FILE_CONFLICT");

      const sameLessonCreate = lesson.fileAction === "create"
        && lesson.existingContent === ""
        && existing.conceptNameEn === lesson.conceptNameEn;
      const sameLessonModify = lesson.fileAction === "modify"
        && lesson.existingContent !== undefined
        && (
          existing.content === lesson.existingContent
          || (existing.conceptNameEn === lesson.conceptNameEn && existing.content.startsWith(lesson.existingContent))
        );
      if (
        (!sameLessonCreate && !sameLessonModify)
        || !appendOnlyExtension(existing.content, parsed.data.content)
      ) throw new Error("PROJECT_FILE_CONFLICT");

      const [updated] = await tx.update(projectFilesTable).set({
        content: parsed.data.content,
        conceptNameEn: lesson.conceptNameEn,
        updatedAt: new Date(),
      }).where(and(
        eq(projectFilesTable.id, existing.id),
        eq(projectFilesTable.status, "in_progress"),
      )).returning();
      if (!updated) throw new Error("PROJECT_FILE_CONFLICT");
      const [submission] = await tx.select().from(lessonSubmissionsTable).where(and(
        eq(lessonSubmissionsTable.userId, user.id),
        eq(lessonSubmissionsTable.lessonId, lesson.lessonId),
      )).limit(1).for("update");
      if (submission) {
        if (submission.isReview || submission.targetFile !== planned.path) throw new Error("PROJECT_FILE_CONFLICT");
        await tx.update(lessonSubmissionsTable).set({
          submissionCount: submission.submissionCount + 1,
          updatedAt: new Date(),
        }).where(eq(lessonSubmissionsTable.id, submission.id));
      } else {
        const source = await tx.select({ path: projectFilesTable.path, content: projectFilesTable.content })
          .from(projectFilesTable).where(eq(projectFilesTable.userId, user.id));
        const candidateFiles = source.map((file) => file.path === planned.path
          ? { path: file.path, content: parsed.data.content }
          : file);
        const verification = await verifyProject(candidateFiles, user.techStack as Parameters<typeof verifyProject>[1]);
        await tx.insert(lessonSubmissionsTable).values({
          userId: user.id,
          lessonId: lesson.lessonId,
          targetFile: planned.path,
          isReview: false,
          firstAttemptPassed: verification.status === "passed",
        });
      }
      await recordTouch4SuccessfulSave(
        tx,
        user.id,
        lesson.lessonId,
        reservedAttemptIndex,
        Boolean(submission || (existing.conceptNameEn === lesson.conceptNameEn && existing.content.trim())),
      );
      return { content: updated.content, status: updated.status, sessionId: updated.completedSessionId, isReview: false };
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_FILE_CONFLICT") {
      res.status(409).json({ error: "المسودة تغيرت أو اكتمل الملف. أعد تحميل المهمة قبل الحفظ." });
      return;
    }
    throw error;
  }
  res.json(SaveProjectFileResponse.parse({
    path: planned.path,
    day: planned.day,
    concept: planned.concept,
    description: planned.description,
    status: result.status,
    session_id: result.sessionId,
    content: result.content,
    is_review: result.isReview,
    build_validation: buildValidation,
  }));
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const [[progress], sessions] = await Promise.all([
    db.select().from(progressTable).where(eq(progressTable.userId, user.id)).limit(1),
    db.select().from(sessionsTable).where(eq(sessionsTable.userId, user.id)).orderBy(desc(sessionsTable.timestamp)).limit(6),
  ]);

  res.json(GetDashboardResponse.parse({
    user: publicUser(user),
    progress: {
      total_xp: progress?.totalXp ?? 0,
      level: progress?.level ?? 1,
      streak_days: progress?.streakDays ?? 0,
      last_active: progress?.lastActive ?? null,
    },
    recent_sessions: sessions.map(sessionResponse),
    onboarding_complete: Boolean(user.projectName && user.techStack),
  }));
});

router.get("/sessions", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const sessions = await db.select().from(sessionsTable)
    .where(eq(sessionsTable.userId, user.id))
    .orderBy(desc(sessionsTable.timestamp))
    .limit(20);
  res.json(GetSessionsResponse.parse(sessions.map(sessionResponse)));
});

router.post("/sessions", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;

  const parsed = CreateSessionBody.safeParse(req.body);
  if (
    !parsed.success
    || !parsed.data.concept.trim()
    || parsed.data.mistakes > 100
    || (parsed.data.touches_correct !== undefined && parsed.data.touches_correct > parsed.data.touches_completed)
  ) {
    res.status(400).json({ error: "بيانات الجلسة غير صالحة." });
    return;
  }

  // The four teaching touches award 20 each; the two defense answers award 15 each.
  // Mistakes lower readiness, not the XP earned for eventual correct answers.
  const earned = parsed.data.touches_completed === 5
    ? 110
    : Math.min(parsed.data.touches_completed, 4) * 20;
  const today = dayInDamascus(new Date());
  const previousDay = new Date(`${today}T12:00:00.000Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const yesterday = previousDay.toISOString().slice(0, 10);

  let session: LearningSession;
  try {
    session = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${user.id})::bigint)`);
      await tx.insert(progressTable).values({ userId: user.id }).onConflictDoNothing();
      const [progress] = await tx.select().from(progressTable)
        .where(eq(progressTable.userId, user.id)).for("update");
      if (!progress) throw new Error("Progress row missing after insert");

      const cacheRows = await tx.select().from(generatedSessionsTable)
        .where(eq(generatedSessionsTable.userId, user.id))
        .orderBy(desc(generatedSessionsTable.updatedAt))
        .for("update");
      const lessonProgress = await tx.select({
        userId: sessionsTable.userId,
        lessonId: sessionsTable.lessonId,
        touchesCompleted: sessionsTable.touchesCompleted,
      }).from(sessionsTable).where(eq(sessionsTable.userId, user.id));
      if (parsed.data.lesson_id) {
        const [replay] = await tx.select().from(sessionsTable).where(and(
          eq(sessionsTable.userId, user.id),
          eq(sessionsTable.lessonId, parsed.data.lesson_id),
        )).limit(1);
        if (replay && replay.touchesCompleted >= parsed.data.touches_completed) {
          if (
            replay.concept !== parsed.data.concept
            || replay.concept.split(" — ", 1)[0] !== parsed.data.concept_name_en
            || (parsed.data.concept_id && replay.conceptId !== parsed.data.concept_id)
          ) throw new Error("CURRENT_LESSON_MISMATCH");
          return replay;
        }
      }
      const cached = parsed.data.lesson_id
        ? findOwnedGeneratedLesson(cacheRows, user.id, parsed.data.lesson_id)
        : selectOwnedUnfinishedLesson(cacheRows, lessonProgress, user.id);
      if (!cached) throw new Error("CURRENT_LESSON_REQUIRED");
      const lesson = cachedLesson(cached.payload);
      if (
        !lesson
        || lesson.legacy
        || !lesson.conceptId
        || !lesson.lessonId
        || lesson.conceptNameEn !== parsed.data.concept_name_en
        || parsed.data.concept !== `${lesson.conceptNameEn} — ${lesson.conceptNameAr}`
        || (parsed.data.lesson_id && parsed.data.lesson_id !== lesson.lessonId)
        || (parsed.data.concept_id && parsed.data.concept_id !== lesson.conceptId)
      ) throw new Error("CURRENT_LESSON_MISMATCH");

      const [map] = await tx.select().from(learningMapsTable)
        .where(eq(learningMapsTable.userId, user.id)).limit(1).for("update");
      if (!map) throw new Error("CURRENT_LESSON_REQUIRED");
      const mapConcept = map.concepts.find((item) => item.id === lesson.conceptId);
      if (
        !mapConcept
        || normalizeConceptName(mapConcept.name_en) !== normalizeConceptName(lesson.conceptNameEn)
        || mapConcept.target_file !== lesson.targetFile
        || (!lesson.isReview && mapConcept.status !== "in_progress")
        || (lesson.isReview && (mapConcept.mastery_score === null || mapConcept.mastery_score >= 70))
      ) throw new Error("CURRENT_LESSON_MISMATCH");

      const [existing] = await tx.select().from(sessionsTable).where(and(
        eq(sessionsTable.userId, user.id),
        eq(sessionsTable.lessonId, lesson.lessonId),
      )).limit(1);
      if (existing && existing.touchesCompleted >= parsed.data.touches_completed) {
        if (existing.concept !== parsed.data.concept || (parsed.data.concept_id && existing.conceptId !== parsed.data.concept_id)) {
          throw new Error("CURRENT_LESSON_MISMATCH");
        }
        return existing;
      }

      let completionDraft: typeof projectFilesTable.$inferSelect | undefined;
      if (parsed.data.touches_completed === 5) {
        if (lesson.isReview) {
          const [practice] = await tx.select().from(reviewExercisesTable).where(and(
            eq(reviewExercisesTable.userId, user.id),
            eq(reviewExercisesTable.lessonId, lesson.lessonId),
            eq(reviewExercisesTable.conceptId, lesson.conceptId),
          )).limit(1).for("update");
          if (!practice || practice.targetFile !== lesson.targetFile || !practice.content.trim()) {
            throw new Error("REVIEW_EVIDENCE_REQUIRED");
          }
        } else {
          const [draft] = await tx.select().from(projectFilesTable).where(and(
            eq(projectFilesTable.userId, user.id),
            eq(projectFilesTable.path, lesson.targetFile!),
          )).limit(1).for("update");
          if (
            !draft
            || draft.status !== "in_progress"
            || draft.conceptNameEn !== lesson.conceptNameEn
            || !draft.content.trim()
          ) throw new Error("PROJECT_FILE_DRAFT_REQUIRED");
          completionDraft = draft;
        }
      }

      const touchesCorrect = parsed.data.touches_correct
        ?? conservativeLegacyTouchesCorrect(parsed.data.touches_completed, parsed.data.mistakes);
      const [submissionEvidence] = await tx.select().from(lessonSubmissionsTable).where(and(
        eq(lessonSubmissionsTable.userId, user.id),
        eq(lessonSubmissionsTable.lessonId, lesson.lessonId),
        eq(lessonSubmissionsTable.targetFile, lesson.targetFile!),
      )).limit(1);
      const buildPassed = parsed.data.build_passed === true && submissionEvidence?.firstAttemptPassed === true;
      const masteryEarned = parsed.data.touches_completed === 5
        ? calculateMasteryScore(touchesCorrect, parsed.data.completion_time ?? Number.POSITIVE_INFINITY, buildPassed)
        : null;
      const lessonConcept = `${lesson.conceptNameEn} — ${lesson.conceptNameAr}`;
      const [touch4Support] = parsed.data.touches_completed === 5
        ? await tx.select().from(touch4SupportTable).where(and(
          eq(touch4SupportTable.userId, user.id),
          eq(touch4SupportTable.lessonId, lesson.lessonId),
        )).limit(1).for("update")
        : [];
      const xpPenalty = touch4Support?.buildSaved
        ? touch4XpPenalty(touch4Support.hintsUsed, touch4Support.solutionViewed)
        : 0;
      const firstTryBonus = touch4Support?.buildSaved ? touch4Support.firstTryBonus : 0;
      const sessionEarned = parsed.data.touches_completed === 5
        ? touch4SessionXp(earned, firstTryBonus, xpPenalty, touch4Support?.buildSaved ?? false)
        : earned;
      const additionalXp = parsed.data.touches_completed === 5
        ? xpDeltaForSession(existing?.xpEarned ?? 0, sessionEarned)
        : additionalXpForProgress(existing?.xpEarned ?? 0, sessionEarned);
      const totalXp = Math.max(0, progress.totalXp + additionalXp);
      const streakDays = progress.lastActive === today
        ? progress.streakDays
        : progress.lastActive === yesterday
          ? progress.streakDays + 1
          : 1;
      const [saved] = existing
        ? await tx.update(sessionsTable).set({
          touchesCompleted: parsed.data.touches_completed,
          mistakes: parsed.data.mistakes,
          xpEarned: sessionEarned,
          conceptId: lesson.conceptId,
          lessonId: lesson.lessonId,
          masteryEarned,
          touchesCorrect,
          completionTime: parsed.data.completion_time ?? null,
          isReview: lesson.isReview,
          timestamp: new Date(),
        }).where(eq(sessionsTable.id, existing.id)).returning()
        : await tx.insert(sessionsTable).values({
          userId: user.id,
          concept: lessonConcept,
          touchesCompleted: parsed.data.touches_completed,
          mistakes: parsed.data.mistakes,
          xpEarned: sessionEarned,
          conceptId: lesson.conceptId,
          lessonId: lesson.lessonId,
          masteryEarned,
          touchesCorrect,
          completionTime: parsed.data.completion_time ?? null,
          isReview: lesson.isReview,
        }).returning();
      if (parsed.data.touches_completed === 5 && completionDraft) {
        await tx.update(projectFilesTable).set({
          status: "complete",
          completedSessionId: saved.id,
          updatedAt: new Date(),
        }).where(eq(projectFilesTable.id, completionDraft.id));
      }
      if (parsed.data.touches_completed === 5 && masteryEarned !== null) {
        const concepts = map.concepts.map((item) => item.id === lesson.conceptId
          ? {
            ...item,
            status: masteryEarned >= 70 ? "completed" as const : "needs_review" as const,
            mastery_score: masteryEarned,
            last_reviewed: saved.timestamp.toISOString(),
            session_id: saved.id,
          }
          : item);
        await tx.update(learningMapsTable).set({ concepts, updatedAt: new Date() })
          .where(eq(learningMapsTable.userId, user.id));
      }
      await tx.update(progressTable).set({
        totalXp,
        level: Math.floor(totalXp / 100) + 1,
        streakDays,
        lastActive: today,
      }).where(eq(progressTable.userId, user.id));
      return saved;
    });
  } catch (error) {
    if (error instanceof Error && [
      "PROJECT_FILE_DRAFT_REQUIRED",
        "REVIEW_EVIDENCE_REQUIRED",
      "CURRENT_LESSON_REQUIRED",
      "CURRENT_LESSON_MISMATCH",
    ].includes(error.message)) {
      res.status(409).json({
        error: error.message === "PROJECT_FILE_DRAFT_REQUIRED"
          ? "احفظ مسودة ملف المهمة قبل إكمال الجلسة."
          : error.message === "REVIEW_EVIDENCE_REQUIRED"
            ? "احفظ كود تمرين المراجعة قبل إكمال الجلسة."
          : error.message === "CURRENT_LESSON_REQUIRED"
            ? "لا توجد جلسة مولدة حالية. أنشئ جلسة ثم أعد المحاولة."
            : "بيانات الجلسة لا تطابق الدرس المولد الحالي. أعد تحميل الدرس.",
      });
      return;
    }
    throw error;
  }

  res.status(201).json(CreateSessionResponse.parse(sessionResponse(session)));
});

export default router;