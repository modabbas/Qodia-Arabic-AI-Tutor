import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  generatedSessionsTable,
  progressTable,
  projectFilesTable,
  sessionsTable,
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

router.post("/save-file", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = SaveProjectFileBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.file_path.trim() || !parsed.data.concept_name_en.trim()
    || !parsed.data.content.trim() || Buffer.byteLength(parsed.data.content, "utf8") > 30_720) {
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
  let saved: typeof projectFilesTable.$inferSelect;
  try {
    saved = await db.transaction(async (tx) => {
      const sessionDate = dayInDamascus(new Date());
      const [cached] = await tx.select().from(generatedSessionsTable).where(and(
        eq(generatedSessionsTable.userId, user.id),
        eq(generatedSessionsTable.sessionDate, sessionDate),
      )).limit(1).for("update");
      const lesson = cachedLesson(cached?.payload);
      if (
        !lesson
        || lesson.legacy
        || lesson.targetFile !== parsed.data.file_path
        || lesson.conceptNameEn !== parsed.data.concept_name_en
      ) throw new Error("PROJECT_FILE_CONFLICT");

      let [existing] = await tx.select().from(projectFilesTable).where(and(
        eq(projectFilesTable.userId, user.id),
        eq(projectFilesTable.path, planned.path),
      )).limit(1).for("update");

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
        if (inserted) return inserted;
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
      return updated;
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
    status: saved.status,
    session_id: saved.completedSessionId,
    content: saved.content,
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
  if (!parsed.success || !parsed.data.concept.trim() || parsed.data.mistakes > 100) {
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
      await tx.insert(progressTable).values({ userId: user.id }).onConflictDoNothing();
      const [progress] = await tx.select().from(progressTable)
        .where(eq(progressTable.userId, user.id)).for("update");
      if (!progress) throw new Error("Progress row missing after insert");

      // Locking the progress row serializes concurrent saves for this student.
      // A replay of the same concept on the same Damascus day must not award XP twice.
      const concept = parsed.data.concept;
      const [existing] = await tx.select().from(sessionsTable).where(and(
        eq(sessionsTable.userId, user.id),
        eq(sessionsTable.concept, concept),
        sql`(${sessionsTable.timestamp} AT TIME ZONE 'Asia/Damascus')::date = ${today}::date`,
      )).orderBy(desc(sessionsTable.timestamp)).limit(1);
      if (existing && existing.touchesCompleted >= parsed.data.touches_completed) {
        const delimiter = existing.concept.indexOf(" — ");
        if (delimiter < 0 || existing.concept.slice(0, delimiter) !== parsed.data.concept_name_en) {
          throw new Error("CURRENT_LESSON_MISMATCH");
        }
        return existing;
      }

      const [cached] = await tx.select().from(generatedSessionsTable).where(and(
        eq(generatedSessionsTable.userId, user.id),
        eq(generatedSessionsTable.sessionDate, today),
      )).limit(1).for("update");
      if (!cached) throw new Error("CURRENT_LESSON_REQUIRED");
      const lesson = cachedLesson(cached.payload);
      if (
        !lesson
        || lesson.conceptNameEn !== parsed.data.concept_name_en
        || concept !== `${lesson.conceptNameEn} — ${lesson.conceptNameAr}`
      ) throw new Error("CURRENT_LESSON_MISMATCH");

      let completionDraft: typeof projectFilesTable.$inferSelect | undefined;
      if (parsed.data.touches_completed === 5 && !lesson.legacy) {
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

      const additionalXp = Math.max(0, earned - (existing?.xpEarned ?? 0));
      const totalXp = progress.totalXp + additionalXp;
      const streakDays = progress.lastActive === today
        ? progress.streakDays
        : progress.lastActive === yesterday
          ? progress.streakDays + 1
          : 1;
      const [saved] = existing
        ? await tx.update(sessionsTable).set({
          touchesCompleted: parsed.data.touches_completed,
          mistakes: parsed.data.mistakes,
          xpEarned: Math.max(existing.xpEarned, earned),
          timestamp: new Date(),
        }).where(eq(sessionsTable.id, existing.id)).returning()
        : await tx.insert(sessionsTable).values({
          userId: user.id,
          concept,
          touchesCompleted: parsed.data.touches_completed,
          mistakes: parsed.data.mistakes,
          xpEarned: earned,
        }).returning();
      if (parsed.data.touches_completed === 5 && completionDraft) {
        await tx.update(projectFilesTable).set({
          status: "complete",
          completedSessionId: saved.id,
          updatedAt: new Date(),
        }).where(eq(projectFilesTable.id, completionDraft.id));
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
      "CURRENT_LESSON_REQUIRED",
      "CURRENT_LESSON_MISMATCH",
    ].includes(error.message)) {
      res.status(409).json({
        error: error.message === "PROJECT_FILE_DRAFT_REQUIRED"
          ? "احفظ مسودة ملف المهمة قبل إكمال الجلسة."
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