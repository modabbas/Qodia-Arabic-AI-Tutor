import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, storeInterestTable, storeProjectsTable, type StoreProject } from "@workspace/db";
import { CreateStoreInterestBody, CreateStoreInterestParams } from "@workspace/api-zod";
import { cleanStoreText, normalizeStoreContact, StoreSubmissionLimiter, validStoreAdminKey } from "../lib/store-rules";
import { seedStoreProjects } from "../lib/store-seeds";

const router: IRouter = Router();
const limiter = new StoreSubmissionLimiter();
let seeds: Promise<void> | undefined;
function ensureSeeds() {
  seeds ??= seedStoreProjects().catch(error => { seeds = undefined; throw error; });
  return seeds;
}

function publicProject(project: StoreProject) {
  return {
    id: project.id, slug: project.slug, title_ar: project.titleAr, title_en: project.titleEn,
    description_ar: project.descriptionAr, tech_stack: project.techStack, difficulty: project.difficulty,
    price_student_usd: project.priceStudentUsd, price_institute_usd: project.priceInstituteUsd,
    includes: project.includes, images: project.images, status: project.status,
    created_at: project.createdAt.toISOString(),
  };
}

router.get("/store/projects", async (_req, res) => {
  await ensureSeeds();
  const projects = await db.select().from(storeProjectsTable)
    .where(inArray(storeProjectsTable.status, ["coming_soon", "available"]))
    .orderBy(storeProjectsTable.createdAt, storeProjectsTable.slug);
  res.json(projects.map(publicProject));
});

router.get("/store/projects/:slug", async (req, res) => {
  if (req.params.slug.length > 100 || !/^[a-z0-9-]+$/.test(req.params.slug)) {
    res.status(404).json({ error: "المشروع غير موجود." });
    return;
  }
  await ensureSeeds();
  const [project] = await db.select().from(storeProjectsTable).where(and(
    eq(storeProjectsTable.slug, req.params.slug),
    inArray(storeProjectsTable.status, ["coming_soon", "available"]),
  )).limit(1);
  if (!project) { res.status(404).json({ error: "المشروع غير موجود." }); return; }
  res.json(publicProject(project));
});

router.post("/store/projects/:id/interest", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!limiter.allow(req.ip ?? "unknown")) {
    res.status(429).json({ error: "وصلت للحد المؤقت للطلبات. حاول لاحقًا." }); return;
  }
  const path = CreateStoreInterestParams.safeParse(req.params);
  const parsed = CreateStoreInterestBody.safeParse(req.body);
  if (!path.success || !parsed.success) {
    res.status(400).json({ error: "تحقق من الاسم ووسيلة التواصل ونوع الطلب." }); return;
  }
  let clean: { name: string; contact: { display: string; normalized: string }; note: string };
  try {
    clean = {
      name: cleanStoreText(parsed.data.name, 100),
      contact: normalizeStoreContact(parsed.data.email_or_phone),
      note: cleanStoreText(parsed.data.note ?? "", 1000),
    };
    if (clean.name.length < 2) throw new Error("INVALID_STORE_INPUT");
  } catch {
    res.status(400).json({ error: "أدخل اسمًا صحيحًا وبريدًا إلكترونيًا أو رقم هاتف صالحًا، دون وسوم HTML." }); return;
  }
  const [project] = await db.select({ id: storeProjectsTable.id }).from(storeProjectsTable).where(and(
    eq(storeProjectsTable.id, path.data.id),
    inArray(storeProjectsTable.status, ["coming_soon", "available"]),
  )).limit(1);
  if (!project) { res.status(404).json({ error: "المشروع غير موجود." }); return; }
  try {
    const [saved] = await db.insert(storeInterestTable).values({
      projectId: project.id, name: clean.name, emailOrPhone: clean.contact.display,
      contactNormalized: clean.contact.normalized, type: parsed.data.type, note: clean.note,
    }).onConflictDoNothing({ target: [storeInterestTable.projectId, storeInterestTable.contactNormalized] })
      .returning({ id: storeInterestTable.id });
    if (!saved) {
      res.status(409).json({ error: "وسيلة التواصل هذه مسجّلة بالفعل لهذا المشروع." }); return;
    }
    res.status(201).json({ message: "تم تسجيل اهتمامك. سنتواصل معك عند التوفر. هذا ليس شراءً أو حجزًا مدفوعًا." });
  } catch {
    // Never log submission bodies or contact data.
    req.log.error({ step: "store_interest_save" }, "Store interest could not be saved");
    res.status(503).json({ error: "تعذر حفظ اهتمامك الآن. حاول مرة أخرى." });
  }
});

router.get("/admin/store-interest", async (req, res) => {
  res.set({ "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" });
  const expected = process.env.ADMIN_KEY;
  if (!expected || expected.length < 16 || expected.length > 512) {
    res.status(503).json({ error: "عرض الإدارة غير مهيّأ. أضف سر ADMIN_KEY بطول 16 حرفًا على الأقل." }); return;
  }
  if (!validStoreAdminKey(req.query.key, expected)) {
    res.status(401).json({ error: "غير مصرح بعرض سجل الاهتمام." }); return;
  }
  const rows = await db.select({
    id: storeInterestTable.id, project_id: storeInterestTable.projectId,
    project_title: storeProjectsTable.titleAr, name: storeInterestTable.name,
    email_or_phone: storeInterestTable.emailOrPhone, type: storeInterestTable.type,
    note: storeInterestTable.note, created_at: storeInterestTable.createdAt,
  }).from(storeInterestTable).innerJoin(storeProjectsTable, eq(storeInterestTable.projectId, storeProjectsTable.id))
    .orderBy(desc(storeInterestTable.createdAt));
  res.json(rows.map(row => ({ ...row, created_at: row.created_at.toISOString() })));
});

export default router;
