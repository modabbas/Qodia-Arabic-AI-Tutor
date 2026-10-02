import { Router, type IRouter, type Response } from "express";
import {
  AbandonDefenseParams,
  AbandonDefenseResponse,
  AdvanceDefenseParams,
  AdvanceDefenseResponse,
  CompleteDefenseBody,
  CompleteDefenseResponse,
  GetDefenseParams,
  GetDefenseResponse,
  GetDefenseSummaryResponse,
  SaveDefenseDraftBody,
  SaveDefenseDraftParams,
  SaveDefenseDraftResponse,
  StartDefenseResponse,
  SubmitDefenseAnswerBody,
  SubmitDefenseAnswerResponse,
} from "@workspace/api-zod";
import { requireUser } from "../lib/qodia-auth";
import {
  abandonDefense,
  advanceDefense,
  completeDefense,
  DefenseServiceError,
  getDefenseSimulation,
  getDefenseSummary,
  saveDefenseDraft,
  startDefense,
  submitDefenseAnswer,
} from "../lib/defense-service";

const router: IRouter = Router();

function reportError(res: Response, status: number, message: string) {
  res.status(status).json({ error: message });
}

function errorStatus(code: string) {
  if (code.startsWith("DEFENSE_NOT_ELIGIBLE:") || code === "DEFENSE_PROFILE_INCOMPLETE") return 400;
  if (code === "DEFENSE_UNSUPPORTED_TECH_STACK") return 400;
  if (code === "DEFENSE_ALREADY_ACTIVE") return 409;
  if (code.endsWith("_NOT_FOUND")) return 404;
  if (code === "DEFENSE_DEADLINE_PASSED" || code === "DEFENSE_ANSWER_LOCKED"
    || code === "DEFENSE_QUESTION_NOT_CURRENT" || code === "DEFENSE_NOT_ACTIVE"
    || code === "DEFENSE_ANSWER_NOT_SCORED" || code === "DEFENSE_LAST_QUESTION"
    || code === "DEFENSE_NOT_FULLY_SCORED") return 409;
  return 500;
}

function userMessage(error: DefenseServiceError) {
  switch (error.code) {
    case "DEFENSE_ALREADY_ACTIVE": return "لديك محاكاة مناقشة نشطة بالفعل. أكملها أو أوقفها قبل بدء محاولة جديدة.";
    case "DEFENSE_PROFILE_INCOMPLETE": return "أكمل بيانات المشروع والتقنية قبل بدء المناقشة.";
    case "DEFENSE_DEADLINE_PASSED": return "انتهى وقت هذا السؤال؛ أرسل المسودة المحفوظة إن وُجدت.";
    case "DEFENSE_ANSWER_LOCKED": return "تم تثبيت الإجابة ولا يمكن تغييرها.";
    case "DEFENSE_QUESTION_NOT_CURRENT": return "هذا السؤال ليس السؤال الحالي في المحاكاة.";
    case "DEFENSE_NOT_ACTIVE": return "هذه المحاكاة لم تعد نشطة.";
    case "DEFENSE_ANSWER_NOT_SCORED": return "انتظر حفظ تقييم السؤال قبل الانتقال للسؤال التالي.";
    case "DEFENSE_LAST_QUESTION": return "أكمل المحاكاة بعد تقييم السؤال الأخير.";
    case "DEFENSE_NOT_FULLY_SCORED": return "يجب تقييم الأسئلة الخمسة قبل إنهاء المناقشة.";
    case "DEFENSE_UNSUPPORTED_TECH_STACK": return "لا يتوفر بنك أسئلة احتياطي لهذه التقنية.";
    default:
      if (error.code.startsWith("DEFENSE_NOT_ELIGIBLE:")) return error.code.slice("DEFENSE_NOT_ELIGIBLE:".length);
      return "تعذر العثور على المحاكاة المطلوبة.";
  }
}

function sendServiceError(res: Response, error: unknown) {
  if (!(error instanceof DefenseServiceError)) throw error;
  const status = errorStatus(error.code);
  reportError(res, status, userMessage(error));
}

router.post("/defense/start", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const result = await startDefense(user.id, { projectName: user.projectName, techStack: user.techStack });
    res.setHeader("Cache-Control", "private, no-store");
    res.status(201).json(StartDefenseResponse.parse(result));
  } catch (error) {
    sendServiceError(res, error);
  }
});

router.post("/defense/submit-answer", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = SubmitDefenseAnswerBody.safeParse(req.body);
  if (!parsed.success) {
    reportError(res, 400, "بيانات الإجابة غير صالحة.");
    return;
  }
  try {
    const result = await submitDefenseAnswer(
      user.id,
      parsed.data.simulation_id,
      parsed.data.question_number,
      parsed.data.answer,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.json(SubmitDefenseAnswerResponse.parse(result));
  } catch (error) {
    sendServiceError(res, error);
  }
});

router.post("/defense/complete", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = CompleteDefenseBody.safeParse(req.body);
  if (!parsed.success) {
    reportError(res, 400, "معرّف المحاكاة غير صالح.");
    return;
  }
  try {
    const result = await completeDefense(user.id, parsed.data.simulation_id);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(CompleteDefenseResponse.parse(result));
  } catch (error) {
    sendServiceError(res, error);
  }
});

router.get("/defense/summary", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const result = await getDefenseSummary(user.id);
  res.setHeader("Cache-Control", "private, no-store");
  res.json(GetDefenseSummaryResponse.parse(result));
});

router.get("/defense/:id", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const params = GetDefenseParams.safeParse(req.params);
  if (!params.success) {
    reportError(res, 400, "معرّف المحاكاة غير صالح.");
    return;
  }
  try {
    const result = await getDefenseSimulation(user.id, params.data.id);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(GetDefenseResponse.parse(result));
  } catch (error) {
    sendServiceError(res, error);
  }
});

router.post("/defense/:id/advance", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const params = AdvanceDefenseParams.safeParse(req.params);
  if (!params.success) {
    reportError(res, 400, "معرّف المحاكاة غير صالح.");
    return;
  }
  try {
    const result = await advanceDefense(user.id, params.data.id);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(AdvanceDefenseResponse.parse(result));
  } catch (error) {
    sendServiceError(res, error);
  }
});

router.post("/defense/:id/abandon", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const params = AbandonDefenseParams.safeParse(req.params);
  if (!params.success) {
    reportError(res, 400, "معرّف المحاكاة غير صالح.");
    return;
  }
  try {
    const result = await abandonDefense(user.id, params.data.id);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(AbandonDefenseResponse.parse(result));
  } catch (error) {
    sendServiceError(res, error);
  }
});

router.patch("/defense/:id/draft", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const params = SaveDefenseDraftParams.safeParse(req.params);
  const parsed = SaveDefenseDraftBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    reportError(res, 400, "بيانات المسودة غير صالحة.");
    return;
  }
  try {
    const result = await saveDefenseDraft(user.id, params.data.id, parsed.data.question_number, parsed.data.draft);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(SaveDefenseDraftResponse.parse(result));
  } catch (error) {
    sendServiceError(res, error);
  }
});

export default router;