import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, progressTable, sessionsTable, usersTable, type LearningSession } from "@workspace/db";
import {
  CompleteOnboardingBody,
  CompleteOnboardingResponse,
  CreateSessionBody,
  CreateSessionResponse,
  GetDashboardResponse,
  GetSessionsResponse,
} from "@workspace/api-zod";
import { publicUser, requireUser } from "../lib/qodia-auth";

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
  res.json(CompleteOnboardingResponse.parse(publicUser(updated)));
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

  const session = await db.transaction(async (tx) => {
    await tx.insert(progressTable).values({ userId: user.id }).onConflictDoNothing();
    const [progress] = await tx.select().from(progressTable)
      .where(eq(progressTable.userId, user.id)).for("update");
    if (!progress) throw new Error("Progress row missing after insert");

    const totalXp = progress.totalXp + earned;
    const streakDays = progress.lastActive === today
      ? progress.streakDays
      : progress.lastActive === yesterday
        ? progress.streakDays + 1
        : 1;
    const [created] = await tx.insert(sessionsTable).values({
      userId: user.id,
      concept: parsed.data.concept.trim(),
      touchesCompleted: parsed.data.touches_completed,
      mistakes: parsed.data.mistakes,
      xpEarned: earned,
    }).returning();
    await tx.update(progressTable).set({
      totalXp,
      level: Math.floor(totalXp / 100) + 1,
      streakDays,
      lastActive: today,
    }).where(eq(progressTable.userId, user.id));
    return created;
  });

  res.status(201).json(CreateSessionResponse.parse(sessionResponse(session)));
});

export default router;