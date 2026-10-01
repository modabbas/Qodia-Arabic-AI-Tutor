import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, learningMapsTable, sessionsTable } from "@workspace/db";
import {
  GetLearningMapResponse,
  UpdateMasteryBody,
  UpdateMasteryResponse,
} from "@workspace/api-zod";
import { requireUser } from "../lib/qodia-auth";
import { ensureLearningMap, learningMapResponse } from "../lib/learning-map-service";
import { isProjectTechStack } from "../lib/project-builder";

const router: IRouter = Router();

function profile(user: { projectName: string | null; techStack: string | null }) {
  const projectName = user.projectName?.trim();
  if (!projectName || !isProjectTechStack(user.techStack)) return null;
  return { projectName, techStack: user.techStack };
}

async function getOrCreateMap(
  userId: string,
  projectName: string,
  techStack: Parameters<typeof ensureLearningMap>[2],
  req: Parameters<typeof ensureLearningMap>[3],
) {
  return ensureLearningMap(userId, projectName, techStack, req);
}

router.get("/learning-map", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const currentProfile = profile(user);
  if (!currentProfile) {
    res.status(400).json({ error: "أكمل اسم المشروع واختر التقنية من ملفك الشخصي أولاً." });
    return;
  }
  try {
    const map = await getOrCreateMap(user.id, currentProfile.projectName, currentProfile.techStack, req);
    res.json(GetLearningMapResponse.parse(learningMapResponse(map)));
  } catch (error) {
    req.log.error({ reason: error instanceof Error ? error.message : "learning_map_unavailable" }, "Learning map is unavailable");
    res.status(503).json({ error: "تعذر تجهيز خارطة التعلّم الآن. أعد المحاولة لاحقاً؛ لم نفقد تقدمك المحفوظ." });
  }
});

router.post("/generate-learning-map", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const currentProfile = profile(user);
  if (!currentProfile) {
    res.status(400).json({ error: "أكمل اسم المشروع واختر التقنية من ملفك الشخصي أولاً." });
    return;
  }
  try {
    const map = await getOrCreateMap(user.id, currentProfile.projectName, currentProfile.techStack, req);
    res.json(GetLearningMapResponse.parse(learningMapResponse(map)));
  } catch (error) {
    req.log.error({ reason: error instanceof Error ? error.message : "learning_map_unavailable" }, "Learning map generation failed");
    res.status(503).json({ error: "تعذر إنشاء خارطة التعلّم الآن. أعد المحاولة لاحقاً؛ سنحتفظ ببيانات مشروعك." });
  }
});

router.post("/update-mastery", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = UpdateMasteryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "معرّف الجلسة غير صالح." });
    return;
  }
  const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.id, parsed.data.session_id)).limit(1);
  if (!session || session.userId !== user.id) {
    res.status(404).json({ error: "الجلسة غير موجودة لهذا الحساب." });
    return;
  }
  if (session.touchesCompleted < 5 || session.masteryEarned === null) {
    res.status(409).json({ error: "أكمل اللمسات الخمس قبل تأكيد إتقان المفهوم." });
    return;
  }
  let map = await db.select().from(learningMapsTable).where(eq(learningMapsTable.userId, user.id)).limit(1).then(([row]) => row);
  if (!map) {
    const currentProfile = profile(user);
    if (!currentProfile) {
      res.status(400).json({ error: "أكمل اسم المشروع واختر التقنية قبل تحديث الإتقان." });
      return;
    }
    map = await getOrCreateMap(user.id, currentProfile.projectName, currentProfile.techStack, req);
  }
  res.json(UpdateMasteryResponse.parse(learningMapResponse(map)));
});

export default router;