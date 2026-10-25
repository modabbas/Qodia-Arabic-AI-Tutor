import { db, storeProjectsTable } from "@workspace/db";

// Placeholder catalog only. Do not overwrite later editorial changes.
export async function seedStoreProjects() {
  const includes = [
    "الكود المصدري للمشروع",
    "شرح كامل لكل ملف",
    "أسئلة مناقشة جاهزة",
    "اختبار فهم وبطاقة فهم بعد الاجتياز",
  ];
  await db.insert(storeProjectsTable).values([
    {
      slug: "flutter-project-preview",
      titleAr: "مشروع Flutter تجريبي",
      titleEn: "Flutter Project Preview",
      descriptionAr: "حزمة مشروع تخرّج بتقنية Flutter قيد التحضير. هذا إدراج مبدئي بعنوان ووصف قابلين للاستبدال، وسيتم توضيح فكرة المشروع ومحتوياته قبل الإتاحة.",
      techStack: "Flutter", difficulty: "متوسط", priceStudentUsd: 200, priceInstituteUsd: 250,
      includes, images: [], status: "coming_soon",
    },
    {
      slug: "django-project-preview",
      titleAr: "مشروع Django تجريبي",
      titleEn: "Django Project Preview",
      descriptionAr: "حزمة مشروع تخرّج بتقنية Django قيد التحضير. هذا إدراج مبدئي بعنوان ووصف قابلين للاستبدال، وسيتم توضيح فكرة المشروع ومحتوياته قبل الإتاحة.",
      techStack: "Django", difficulty: "مبتدئ", priceStudentUsd: 250, priceInstituteUsd: 300,
      includes, images: [], status: "coming_soon",
    },
  ]).onConflictDoNothing({ target: storeProjectsTable.slug });
}
