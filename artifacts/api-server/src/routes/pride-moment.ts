import { Router, type IRouter } from "express";
import { and, asc, count, eq, sql } from "drizzle-orm";
import { db, projectFilesTable, reviewExercisesTable, sessionsTable } from "@workspace/db";
import { GetPrideMomentQueryParams, GetPrideMomentResponse } from "@workspace/api-zod";
import { requireUser } from "../lib/qodia-auth";
import { codePreview, snippetDay } from "../lib/pride-moment";

const router: IRouter = Router();
router.get("/pride-moment", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const params = GetPrideMomentQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: "معرّف الجلسة غير صالح." }); return; }
  res.setHeader("Cache-Control", "private, no-store");
  const [total] = await db.select({ value: count() }).from(sessionsTable)
    .where(and(eq(sessionsTable.userId, user.id), eq(sessionsTable.touchesCompleted, 5)));
  const completed = total?.value ?? 0;
  let comparison = null;
  if (params.data.session_id) {
    const [session] = await db.select().from(sessionsTable).where(and(
      eq(sessionsTable.userId, user.id), eq(sessionsTable.id, params.data.session_id),
      eq(sessionsTable.touchesCompleted, 5),
    )).limit(1);
    if (!session) { res.status(404).json({ error: "الجلسة المكتملة غير متاحة." }); return; }
    if (completed > 0 && completed % 5 === 0) {
      const [first] = await db.select().from(projectFilesTable).where(and(
        eq(projectFilesTable.userId, user.id), eq(projectFilesTable.status, "complete"),
        sql`length(trim(${projectFilesTable.content})) > 0`,
      )).orderBy(asc(projectFilesTable.createdAt), asc(projectFilesTable.id)).limit(1);
      // Anchor the latest code to this completed session, not another tab's save.
      const [file] = await db.select().from(projectFilesTable).where(and(
        eq(projectFilesTable.userId, user.id), eq(projectFilesTable.completedSessionId, session.id),
        eq(projectFilesTable.status, "complete"),
      )).limit(1);
      const [review] = session.isReview && session.lessonId
        ? await db.select().from(reviewExercisesTable).where(and(
          eq(reviewExercisesTable.userId, user.id), eq(reviewExercisesTable.lessonId, session.lessonId),
        )).limit(1) : [];
      const latest = review ? { ...review, path: review.targetFile } : file;
      if (first && latest?.content.trim()) {
        const snippet = (record: typeof first) => ({
          path: record.path, ...codePreview(record.content),
          day: snippetDay(first.createdAt, record.updatedAt),
          modified_since_creation: record.updatedAt.getTime() > record.createdAt.getTime(),
        });
        comparison = {
          first: { ...snippet(first), day: 1 },
          latest: {
            path: latest.path, ...codePreview(latest.content),
            day: snippetDay(first.createdAt, latest.updatedAt),
            modified_since_creation: latest.updatedAt.getTime() > latest.createdAt.getTime(),
          },
        };
      }
    }
  }
  res.json(GetPrideMomentResponse.parse({ completed_sessions_count: completed, comparison }));
});
export default router;