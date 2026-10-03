import { Router, type IRouter, type Response } from "express";
import { GenerateAnyFieldSessionBody, ReactToAnyFieldAnswerBody } from "@workspace/api-zod";
import { generateAnyFieldDemo, reactToAnyFieldDemo } from "../lib/any-field-demo-generation";
import { AnyFieldDemoBudget } from "../lib/any-field-demo-rules";

// Public and intentionally isolated: no auth, database, XP or student-system imports.
const router: IRouter = Router();
const budget = new AnyFieldDemoBudget();
let inFlight = 0;
function acquireSlot(res: Response): boolean {
  if (inFlight >= 4) {
    res.setHeader("Retry-After", "5");
    res.status(503).json({ error: "التجربة مشغولة الآن. انتظر لحظة ثم أعد المحاولة." });
    return false;
  }
  inFlight++;
  return true;
}
router.use("/try-any-field", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (!budget.consume(req.ip ?? "anonymous")) {
    res.setHeader("Retry-After", "600");
    res.status(429).json({ error: "وصلت التجربة إلى حد الطلبات المؤقت. جرّب بعد دقائق." });
    return;
  }
  next();
});

router.post("/try-any-field/session", async (req, res): Promise<void> => {
  const parsed = GenerateAnyFieldSessionBody.safeParse(req.body);
  if (!parsed.success || parsed.data.field.trim().length < 2 || parsed.data.topic.trim().length < 2) {
    res.status(400).json({ error: "اختر مجالاً واكتب مفهوماً واضحاً لتبدأ." }); return;
  }
  if (!acquireSlot(res)) return;
  try {
    res.json(await generateAnyFieldDemo({ field: parsed.data.field.trim(), topic: parsed.data.topic.trim() }));
  } catch {
    // No lesson, answer, medical topic, provider error/key or account metadata in logs.
    req.log.warn({ stage: "any_field_generation" }, "Public educational demo generation unavailable");
    res.status(503).json({ error: "تعذّر توليد التجربة الآن. مدخلاتك محفوظة في هذه الصفحة؛ حاول مجدداً." });
  } finally {
    inFlight--;
  }
});

router.post("/try-any-field/reaction", async (req, res): Promise<void> => {
  const parsed = ReactToAnyFieldAnswerBody.safeParse(req.body);
  if (!parsed.success || parsed.data.answer_ar.trim().length < 2
    || parsed.data.field.trim().length < 2 || parsed.data.topic.trim().length < 2
    || !parsed.data.question_ar.trim() || !parsed.data.explanation_ar.trim()) {
    res.status(400).json({ error: "اكتب إجابة قصيرة عن سبب اختيارك." }); return;
  }
  if (!acquireSlot(res)) return;
  try {
    res.json(await reactToAnyFieldDemo({ ...parsed.data, answer_ar: parsed.data.answer_ar.trim() }));
  } catch {
    req.log.warn({ stage: "any_field_reaction" }, "Public educational demo reaction unavailable");
    res.status(503).json({ error: "تعذّر التعقيب الآن. يمكنك إعادة المحاولة دون تغيير إجابتك." });
  } finally {
    inFlight--;
  }
});
export default router;