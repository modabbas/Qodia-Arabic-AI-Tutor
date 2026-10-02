import { Router, type IRouter } from "express";
import {
  GetTouch4SupportQueryParams,
  GetTouch4SupportResponse,
  RevealTouch4HintBody,
  RevealTouch4HintResponse,
} from "@workspace/api-zod";
import { requireUser } from "../lib/qodia-auth";
import { getTouch4Support, revealTouch4Support } from "../lib/touch4-support";

const router: IRouter = Router();

router.get("/touch4-support", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = GetTouch4SupportQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "معرّف درس البناء غير صالح." });
    return;
  }
  try {
    const result = await getTouch4Support(user.id, parsed.data.lesson_id);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(GetTouch4SupportResponse.parse(result));
  } catch (error) {
    if (error instanceof Error && error.message === "TOUCH4_LESSON_UNAVAILABLE") {
      res.status(404).json({ error: "درس البناء غير متاح أو اكتمل." });
      return;
    }
    throw error;
  }
});

router.post("/touch4-support/reveal", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = RevealTouch4HintBody.safeParse(req.body);
  if (!parsed.success
    || (parsed.data.kind === "hint" && parsed.data.level === undefined)
    || (parsed.data.kind === "solution" && parsed.data.level !== undefined)) {
    res.status(400).json({ error: "طلب التلميح غير صالح." });
    return;
  }
  try {
    const result = await revealTouch4Support(
      user.id,
      parsed.data.lesson_id,
      parsed.data.kind,
      parsed.data.level,
      user.techStack,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.json(RevealTouch4HintResponse.parse(result));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "";
    if (reason === "TOUCH4_LESSON_UNAVAILABLE") {
      res.status(404).json({ error: "درس البناء غير متاح أو اكتمل." });
      return;
    }
    if (reason === "TOUCH4_HINT_LOCKED" || reason === "TOUCH4_SOLUTION_LOCKED") {
      res.status(409).json({ error: "هذا التلميح لسه مقفول؛ جرّب الكود وأعد المحاولة بعد فشل التحقق." });
      return;
    }
    if (reason === "TOUCH4_BUILD_ALREADY_SAVED") {
      res.status(409).json({ error: "انحفظ الحل المقبول، وما عاد فينا نكشف مساعدة جديدة لهالمهمة." });
      return;
    }
    if (reason === "TOUCH4_HINT_LEVEL_INVALID") {
      res.status(400).json({ error: "مستوى التلميح غير صالح." });
      return;
    }
    if (reason === "TOUCH4_HINTS_UNAVAILABLE") {
      req.log.warn({ lesson_id: parsed.data.lesson_id }, "Touch 4 hint generation unavailable");
      res.status(503).json({ error: "ما قدرنا نجهّز التلميح هلأ، ما انخصم أي رصيد. جرّب بعد شوي." });
      return;
    }
    throw error;
  }
});

export default router;