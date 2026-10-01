import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, progressTable, usersTable } from "@workspace/db";
import {
  GetCurrentUserResponse,
  LogInBody,
  LogInResponse,
  LogOutResponse,
  SignUpBody,
  SignUpResponse,
} from "@workspace/api-zod";
import { clearSession, issueSession, publicUser, requireUser } from "../lib/qodia-auth";
import { ensureLearningMap } from "../lib/learning-map-service";
import { isProjectTechStack } from "../lib/project-builder";

const router: IRouter = Router();

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignUpBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.name.trim()) {
    res.status(400).json({ error: "تحقق من الاسم والبريد وكلمة المرور (8 أحرف على الأقل)." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing) {
    res.status(409).json({ error: "هذا البريد مسجّل بالفعل." });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  try {
    const user = await db.transaction(async (tx) => {
      const [created] = await tx.insert(usersTable).values({
        email,
        passwordHash,
        name: parsed.data.name.trim(),
      }).returning();
      await tx.insert(progressTable).values({ userId: created.id });
      return created;
    });
    await issueSession(res, user.id);
    res.status(201).json(SignUpResponse.parse({ user: publicUser(user) }));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "هذا البريد مسجّل بالفعل." });
      return;
    }
    throw error;
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LogInBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "أدخل بريداً صحيحاً وكلمة مرور صالحة." });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const valid = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
  if (!valid || !user) {
    res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة." });
    return;
  }

  await issueSession(res, user.id);
  res.json(LogInResponse.parse({ user: publicUser(user) }));
  if (user.projectName?.trim() && isProjectTechStack(user.techStack)) {
    void ensureLearningMap(user.id, user.projectName, user.techStack, req).catch((error: unknown) => {
      req.log.warn({ reason: error instanceof Error ? error.message : "learning_map_unavailable" }, "Login succeeded; learning map will retry on access");
    });
  }
});

router.post("/auth/logout", (_req, res): void => {
  clearSession(res);
  res.json(LogOutResponse.parse({ ok: true }));
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  res.json(GetCurrentUserResponse.parse({ user: publicUser(user) }));
});

export default router;