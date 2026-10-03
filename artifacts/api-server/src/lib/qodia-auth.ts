import type { Request, Response } from "express";
import { db, usersTable, type User } from "@workspace/db";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";

const cookieName = "qodia_session";
const sevenDays = 7 * 24 * 60 * 60 * 1000;
const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;

if (!secret) {
  throw new Error("JWT_SECRET or SESSION_SECRET must be configured for account sessions.");
}

const signingKey = new TextEncoder().encode(secret);
const cookieOptions = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function issueSession(res: Response, userId: string): Promise<void> {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer("qodia")
    .setAudience("qodia-web")
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(signingKey);
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: sevenDays });
}

export function clearSession(res: Response): void {
  res.clearCookie(cookieName, cookieOptions);
}

export async function requireUser(req: Request, res: Response): Promise<User | null> {
  const token = req.cookies?.[cookieName];
  if (typeof token !== "string") {
    res.status(401).json({ error: "سجّل الدخول للمتابعة." });
    return null;
  }

  let userId: string | undefined;
  try {
    const verified = await jwtVerify(token, signingKey, {
      issuer: "qodia",
      audience: "qodia-web",
      algorithms: ["HS256"],
    });
    userId = verified.payload.sub;
  } catch {
    clearSession(res);
    res.status(401).json({ error: "انتهت جلستك. سجّل الدخول مجدداً." });
    return null;
  }

  if (!userId) {
    clearSession(res);
    res.status(401).json({ error: "انتهت جلستك. سجّل الدخول مجدداً." });
    return null;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    clearSession(res);
    res.status(401).json({ error: "انتهت جلستك. سجّل الدخول مجدداً." });
    return null;
  }
  return user;
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    project_name: user.projectName,
    tech_stack: user.techStack,
    secondary_tech_stack: user.secondaryTechStack ?? null,
    created_at: user.createdAt.toISOString(),
  };
}