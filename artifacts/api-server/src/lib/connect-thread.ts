const stacks = new Set(["React", "Vue", "Flutter", "Django", "Node.js", "Other"]);

export function secondaryStackContext(value: unknown): string | null {
  return typeof value === "string" && stacks.has(value) ? value : null;
}

/** Optional reinforcement must never invalidate an otherwise valid lesson. */
export function withConnectThreadFallback(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input) || !("connect_thread" in input)) return input;
  const { connect_thread: raw, ...lesson } = input;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return lesson;
  const value = raw as Record<string, unknown>;
  const text = (item: unknown, max: number): item is string =>
    typeof item === "string" && !!item.trim() && item.length <= max;
  if (!text(value.intro_ar, 500) || !text(value.integration_snippet, 1800)
    || !text(value.comprehension_question_ar, 500) || !Array.isArray(value.options)
    || value.options.length < 2 || value.options.length > 3) return lesson;
  const lines = value.integration_snippet.trim().split(/\r?\n/);
  if (lines.length < 5 || lines.length > 8) return lesson;
  const options: { text_ar: string; correct: boolean }[] = [];
  for (const rawOption of value.options) {
    if (!rawOption || typeof rawOption !== "object" || Array.isArray(rawOption)
      || !text(rawOption.text_ar, 300) || typeof rawOption.correct !== "boolean") return lesson;
    options.push({ text_ar: rawOption.text_ar.trim(), correct: rawOption.correct });
  }
  if (options.filter(option => option.correct).length !== 1
    || new Set(options.map(option => option.text_ar)).size !== options.length) return lesson;
  return { ...lesson, connect_thread: {
    intro_ar: value.intro_ar.trim(), integration_snippet: value.integration_snippet.trim(),
    comprehension_question_ar: value.comprehension_question_ar.trim(), options,
  } };
}

export function connectThreadInstruction(stack: unknown): string[] {
  const secondary = secondaryStackContext(stack);
  if (!secondary) return [];
  return [
    `أضف connect_thread اختيارياً لتقنية الطالب الثانوية ${secondary} ضمن نفس JSON ونفس الاستجابة فقط؛ لا تغيّر التقنية الأساسية أو الدرس أو ملف البناء.`,
    "وصل الخيط: intro_ar مقدمة عربية بسيطة، integration_snippet مثال توضيحي 5–8 أسطر فقط يربط الكود الأساسي للمفهوم المختار بهذه التقنية الثانوية في مشروع الطالب، comprehension_question_ar سؤال فهم بسيط عن العلاقة، options فيها 2–3 خيارات عربية مع واحد فقط correct=true.",
    "هذه معاينة تعليمية وليست كوداً محفوظاً أو منفّذاً أو مهمة بناء. لا تزعم وجود API أو ملف لم يبنه الطالب؛ سمّ المسارات والبيانات الافتراضية أمثلة توضيحية. إذا كان الدرس إعدادات أو موديلات غير مكشوفة عبر API، وضّح الرابط غير المباشر والحاجة لطبقة وسيطة، لا تخترع endpoint جاهزاً.",
    ...(secondary === "Other" ? ["التقنية الثانوية غير محددة: استخدم شبهكود توضيحياً وسمّه صراحة شبهكود، ولا تنسبه للغة محددة."] : [`اكتب المثال بلغة ${secondary} وبصيغة مناسبة لها، لا بمثال JavaScript عام لكل التقنيات.`]),
  ];
}