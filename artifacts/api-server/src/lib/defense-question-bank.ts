import type { DefenseFile, DefenseConcept, DefenseQuestion } from "./defense-rules.ts";
import { expectedDifficulty, newDefenseQuestion } from "./defense-rules.ts";

type QuestionTemplate = { id: string; level: number; wording: string };

const bank: Record<string, string[][]> = {
  Django: [
    [
      "اشرح كيف يظهر مفهوم {concept} في {file}، وما المسؤولية الأساسية التي يؤديها ضمن تطبيق Django؟",
      "ما المشكلة العملية التي يعالجها {concept} في {file}، وكيف يشارك في دورة الطلب والاستجابة في Django؟",
      "صف تدفق البيانات في {file} عند استخدام {concept}، وما النتيجة التي يتوقعها المستخدم؟",
      "ما الفكرة الأساسية وراء {concept} كما طبّقتها في {file}، وكيف تشرحها لمطور جديد على Django؟",
    ],
    [
      "لماذا اخترت أسلوب {concept} في {file} بدلاً من بديل شائع في Django؟ اذكر مفاضلة واقعية.",
      "ما البديل الممكن لـ {concept} في {file}، ومتى سيكون ذلك البديل أنسب في مشروع Django؟",
      "قارن قرارك باستخدام {concept} في {file} بخيار أبسط، ووضح أثره على قابلية الاختبار.",
      "ما الافتراض الذي بنيت عليه استخدام {concept} في {file}، وكيف يتغير القرار إذا زاد تعقيد التطبيق؟",
    ],
    [
      "إذا وصل إلى {file} إدخال غير صالح أثناء تنفيذ {concept}، كيف تمنع Django نتيجة خاطئة أو استجابة مضللة؟",
      "كيف يتصرف {concept} في {file} عند غياب سجل أو بيانات مطلوبة، وما معالجة الخطأ المناسبة؟",
      "إذا تكرر الطلب على {file} بالتزامن أثناء استخدام {concept}، ما السلوك الذي تتوقعه وكيف تحافظ على صحة البيانات؟",
      "تخيّل أن الاعتماد الذي يستخدمه {concept} في {file} أصبح بطيئاً؛ ما أثر ذلك على الطلب وكيف تعالجه؟",
    ],
    [
      "اربط المفهوم المدروس {concept} بالمفهوم المدروس {second_concept}. ما المسؤولية التي يثبتها فعلياً الملف {file}، وكيف تتقاطع مع المفهومين؟",
      "قارن المفهومين المدروسين {concept} و{second_concept}. ما الذي يطبقه {file} فعلياً، وكيف تبرهن على العلاقة دون افتراض غير موجود؟",
      "كيف يؤثر الجمع بين {concept} و{second_concept} في تصميم Django؟ استخدم المسؤولية الظاهرة في {file} دليلاً لا افتراضاً.",
      "اربط {concept} بـ{second_concept}، ثم وضح كيف يرتبط تدفق الطلب الفعلي في {file} بهذين المفهومين.",
    ],
    [
      "ما أضعف افتراض تصميمي في تطبيق {concept} داخل {file}؟ قدّم حالة فشل وخطوة تحسين قابلة للقياس.",
      "لو راجعت {file} قبل إطلاق تطبيق Django، ما الخطر التصميمي المرتبط بـ {concept} الذي ستفحصه أولاً؟",
      "ما حدّ التوسع أو الصيانة في {concept} كما يظهر في {file}، وكيف تعيد تصميمه دون ادعاء أن الملف يفعل أكثر مما يفعل؟",
      "ما قراراً في تنفيذ {concept} داخل {file} ستعيد النظر فيه بعد ظهور متطلبات جديدة، وما الدليل الذي ستطلبه؟",
    ],
  ],
  "Node.js": [
    [
      "اشرح كيف يظهر مفهوم {concept} في {file}، وما المسؤولية الأساسية التي يؤديها ضمن تطبيق Node.js؟",
      "ما المشكلة العملية التي يعالجها {concept} في {file}، وكيف يشارك في تدفق التنفيذ غير المتزامن؟",
      "صف تدفق البيانات في {file} عند استخدام {concept}، وما النتيجة التي يتوقعها المستدعي؟",
      "ما الفكرة الأساسية وراء {concept} كما طبّقتها في {file}، وكيف تشرحها لمطور جديد على Node.js؟",
    ],
    [
      "لماذا اخترت أسلوب {concept} في {file} بدلاً من بديل شائع في Node.js؟ اذكر مفاضلة واقعية.",
      "ما البديل الممكن لـ {concept} في {file}، ومتى سيكون ذلك البديل أنسب في تطبيق Node.js؟",
      "قارن قرارك باستخدام {concept} في {file} بخيار أبسط، ووضح أثره على الاختبار والتعامل مع الأخطاء.",
      "ما الافتراض الذي بنيت عليه استخدام {concept} في {file}، وكيف يتغير القرار مع تعدد الطلبات؟",
    ],
    [
      "إذا فشل استدعاء غير متزامن داخل {file} أثناء تنفيذ {concept}، كيف تمنع خطأً غير معالج أو نتيجة غير صحيحة؟",
      "كيف يتصرف {concept} في {file} عند غياب بيانات مطلوبة، وما مسار الخطأ المناسب للمستهلك؟",
      "إذا وصلت طلبات متزامنة إلى {file} أثناء استخدام {concept}، ما المخاطر وكيف تحافظ على سلامة الحالة؟",
      "تخيّل أن عملية الإدخال والإخراج التي يعتمد عليها {concept} في {file} أصبحت بطيئة؛ ما أثرها وكيف تحدّ منها؟",
    ],
    [
      "اربط المفهوم المدروس {concept} بالمفهوم المدروس {second_concept}. ما المسؤولية التي يثبتها فعلياً الملف {file}، وكيف تتقاطع مع المفهومين؟",
      "قارن المفهومين المدروسين {concept} و{second_concept}. ما الذي يطبقه {file} فعلياً، وكيف تبرهن على العلاقة دون افتراض غير موجود؟",
      "كيف يؤثر الجمع بين {concept} و{second_concept} في تصميم Node.js؟ استخدم المسؤولية الظاهرة في {file} دليلاً لا افتراضاً.",
      "اربط {concept} بـ{second_concept}، ثم وضح كيف يرتبط تدفق التنفيذ الفعلي في {file} بهذين المفهومين.",
    ],
    [
      "ما أضعف افتراض تصميمي في تطبيق {concept} داخل {file}؟ قدّم حالة فشل وخطوة تحسين قابلة للقياس.",
      "لو راجعت {file} قبل إطلاق خدمة Node.js، ما خطر التزامن أو الموارد المرتبط بـ {concept} الذي ستفحصه؟",
      "ما حدّ التوسع أو الصيانة في {concept} كما يظهر في {file}، وكيف تحسّنه دون افتراض سلوك غير موجود؟",
      "ما قراراً في تنفيذ {concept} داخل {file} ستعيد النظر فيه عند ارتفاع الحمل، وما الدليل الذي ستطلبه؟",
    ],
  ],
  React: [
    [
      "اشرح كيف يظهر مفهوم {concept} في {file}، وما المسؤولية الأساسية التي يؤديها ضمن واجهة React؟",
      "ما المشكلة العملية التي يعالجها {concept} في {file}، وكيف يؤثر في العرض الذي يراه المستخدم؟",
      "صف تدفق البيانات في {file} عند استخدام {concept}، وما الذي يؤدي إلى إعادة العرض؟",
      "ما الفكرة الأساسية وراء {concept} كما طبّقتها في {file}، وكيف تشرحها لمطور جديد على React؟",
    ],
    [
      "لماذا اخترت أسلوب {concept} في {file} بدلاً من بديل شائع في React؟ اذكر مفاضلة واقعية.",
      "ما البديل الممكن لـ {concept} في {file}، ومتى سيكون ذلك البديل أنسب في واجهة React؟",
      "قارن قرارك باستخدام {concept} في {file} بخيار أبسط، ووضح أثره على دورة حياة الواجهة.",
      "ما الافتراض الذي بنيت عليه استخدام {concept} في {file}، وكيف يتغير القرار إذا كبر المكوّن؟",
    ],
    [
      "إذا تغيرت خاصية أو بيانات أثناء تنفيذ {concept} في {file}، كيف تمنع عرض حالة قديمة أو غير متسقة؟",
      "كيف يتصرف {concept} في {file} عند غياب البيانات أو فشل التحميل، وما حالة الواجهة الملائمة؟",
      "إذا تكرر تحديث الحالة بسرعة في {file} أثناء استخدام {concept}، ما السلوك المتوقع وكيف تتجنب مشكلة؟",
      "تخيّل أن مصدر البيانات بطيء؛ كيف يحافظ {concept} في {file} على تجربة واضحة واستجابة صحيحة؟",
    ],
    [
      "اربط المفهوم المدروس {concept} بالمفهوم المدروس {second_concept}. ما المسؤولية التي يثبتها فعلياً الملف {file}، وكيف تتقاطع مع المفهومين؟",
      "قارن المفهومين المدروسين {concept} و{second_concept}. ما الذي يطبقه {file} فعلياً، وكيف تبرهن على العلاقة دون افتراض غير موجود؟",
      "كيف يؤثر الجمع بين {concept} و{second_concept} في تصميم React؟ استخدم المسؤولية الظاهرة في {file} دليلاً لا افتراضاً.",
      "اربط {concept} بـ{second_concept}، ثم وضح كيف ترتبط واجهة المستخدم الفعلية في {file} بهذين المفهومين.",
    ],
    [
      "ما أضعف افتراض تصميمي في تطبيق {concept} داخل {file}؟ قدّم حالة فشل وخطوة تحسين قابلة للقياس.",
      "لو راجعت {file} قبل إطلاق واجهة React، ما خطر الأداء أو الحالة المرتبط بـ {concept} الذي ستفحصه؟",
      "ما حدّ التوسع أو الصيانة في {concept} كما يظهر في {file}، وكيف تحسنه دون افتراض سلوك غير موجود؟",
      "ما قراراً في تنفيذ {concept} داخل {file} ستعيد النظر فيه عند زيادة حجم الواجهة، وما الدليل الذي ستطلبه؟",
    ],
  ],
  Flutter: [
    [
      "اشرح كيف يظهر مفهوم {concept} في {file}، وما المسؤولية الأساسية التي يؤديها ضمن تطبيق Flutter؟",
      "ما المشكلة العملية التي يعالجها {concept} في {file}، وكيف يؤثر في الواجهة التي يراها المستخدم؟",
      "صف تدفق البيانات في {file} عند استخدام {concept}، وما الذي يؤدي إلى إعادة بناء الواجهة؟",
      "ما الفكرة الأساسية وراء {concept} كما طبّقتها في {file}، وكيف تشرحها لمطور جديد على Flutter؟",
    ],
    [
      "لماذا اخترت أسلوب {concept} في {file} بدلاً من بديل شائع في Flutter؟ اذكر مفاضلة واقعية.",
      "ما البديل الممكن لـ {concept} في {file}، ومتى سيكون ذلك البديل أنسب في تطبيق Flutter؟",
      "قارن قرارك باستخدام {concept} في {file} بخيار أبسط، ووضح أثره على دورة حياة الواجهة.",
      "ما الافتراض الذي بنيت عليه استخدام {concept} في {file}، وكيف يتغير القرار إذا كبر التطبيق؟",
    ],
    [
      "إذا تغيرت البيانات أثناء تنفيذ {concept} في {file}، كيف تمنع عرض حالة قديمة أو إعادة بناء غير لازمة؟",
      "كيف يتصرف {concept} في {file} عند غياب البيانات أو فشل التحميل، وما حالة الواجهة المناسبة؟",
      "إذا تكرر تحديث الحالة بسرعة في {file} أثناء استخدام {concept}، ما السلوك المتوقع وكيف تتجنب مشكلة؟",
      "تخيّل أن المصدر غير متاح مؤقتاً؛ كيف يحافظ {concept} في {file} على تجربة واضحة واستجابة صحيحة؟",
    ],
    [
      "اربط المفهوم المدروس {concept} بالمفهوم المدروس {second_concept}. ما المسؤولية التي يثبتها فعلياً الملف {file}، وكيف تتقاطع مع المفهومين؟",
      "قارن المفهومين المدروسين {concept} و{second_concept}. ما الذي يطبقه {file} فعلياً، وكيف تبرهن على العلاقة دون افتراض غير موجود؟",
      "كيف يؤثر الجمع بين {concept} و{second_concept} في تصميم Flutter؟ استخدم المسؤولية الظاهرة في {file} دليلاً لا افتراضاً.",
      "اربط {concept} بـ{second_concept}، ثم وضح كيف ترتبط بنية الـWidget الفعلية في {file} بهذين المفهومين.",
    ],
    [
      "ما أضعف افتراض تصميمي في تطبيق {concept} داخل {file}؟ قدّم حالة فشل وخطوة تحسين قابلة للقياس.",
      "لو راجعت {file} قبل إطلاق تطبيق Flutter، ما خطر الأداء أو الحالة المرتبط بـ {concept} الذي ستفحصه؟",
      "ما حدّ التوسع أو الصيانة في {concept} كما يظهر في {file}، وكيف تحسنه دون افتراض سلوك غير موجود؟",
      "ما قراراً في تنفيذ {concept} داخل {file} ستعيد النظر فيه عند زيادة الشاشات، وما الدليل الذي ستطلبه؟",
    ],
  ],
};

export function curatedQuestionTemplates(techStack: string): QuestionTemplate[] {
  const levels = bank[techStack];
  if (!levels) throw new Error("DEFENSE_UNSUPPORTED_TECH_STACK");
  return levels.flatMap((questions, level) => questions.map((wording, variant) => ({
    id: `${techStack.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-l${level + 1}-q${variant + 1}`,
    level: level + 1,
    wording,
  })));
}

export function buildCuratedQuestions(
  techStack: string,
  concepts: DefenseConcept[],
  files: DefenseFile[],
  recentTemplateIds: Set<string>,
): DefenseQuestion[] {
  const templates = curatedQuestionTemplates(techStack);
  const studiedConcepts = concepts.filter((concept) => concept.status === "completed");
  const savedFiles = files.filter((file) => file.status === "complete" && file.content.trim().length > 0);
  if (templates.length !== 20 || studiedConcepts.length < 2 || savedFiles.length === 0) {
    throw new Error("DEFENSE_CURATED_BANK_UNAVAILABLE");
  }
  const normalize = (value: string) => value.trim().toLocaleLowerCase();
  const associatedPairs = savedFiles.flatMap((file) => {
    if (!file.conceptNameEn) return [];
    const concept = studiedConcepts.find((item) =>
      normalize(item.name_en) === normalize(file.conceptNameEn!)
      || normalize(item.name_ar) === normalize(file.conceptNameEn!));
    return concept ? [{ concept, file }] : [];
  });
  const chosen = Array.from({ length: 5 }, (_, index) => {
    const level = index + 1;
    const levelTemplates = templates.filter((template) => template.level === level);
    return levelTemplates.find((template) => !recentTemplateIds.has(template.id)) ?? levelTemplates[0]!;
  });
  return chosen.map((template, index) => {
    const paired = associatedPairs.length > 0 ? associatedPairs[index % associatedPairs.length] : null;
    const conceptIndex = paired
      ? studiedConcepts.indexOf(paired.concept)
      : index % studiedConcepts.length;
    const concept = paired?.concept ?? studiedConcepts[conceptIndex]!;
    const file = paired?.file ?? savedFiles[index % savedFiles.length]!;
    const secondConcept = studiedConcepts.find((candidate) => candidate.name_en !== concept.name_en)!;
    const matchedWording = template.wording.replaceAll("{concept}", concept.name_en)
      .replaceAll("{second_concept}", secondConcept.name_en)
      .replaceAll("{file}", file.path);
    const neutralWording = [
      `اشرح المفهوم المدروس ${concept.name_en}، ثم بيّن ما إذا كان وكيف يرتبط بالمسؤولية التي يثبتها الملف المحفوظ ${file.path}، من دون افتراض تطبيق غير ظاهر.`,
      `لماذا يُستخدم المفهوم ${concept.name_en} بدلاً من بديل؟ استشهد بما يظهر فعلياً في ${file.path}، أو وضح إن لم يكن تطبيق المفهوم ظاهراً فيه.`,
      `إذا طُبّق ${concept.name_en} على السيناريو الذي يعالجه ${file.path}، ما التغيير المتوقع؟ ميّز بين المحتوى الحالي والاقتراح.`,
      `اربط المفهومين المدروسين ${concept.name_en} و${secondConcept.name_en}. ما المسؤولية التي يثبتها ${file.path} فعلياً، وكيف تتقاطع معهما دون افتراض أنه يطبقهما؟`,
      `ما نقطة ضعف التصميم التي يمكن إثباتها من ${file.path}؟ وكيف يمكن للمفهوم المدروس ${concept.name_en} أن يوجّه تحسيناً قابلاً للتحقق دون ادعاء أنه مطبق حالياً؟`,
    ][index]!;
    const question = (paired ? matchedWording : neutralWording);
    const levelPoints = [
      `شرح المفهوم المدروس ${concept.name_en} بدقة.`,
      paired
        ? `توضيح العلاقة بين المفهوم والملف المرتبط به ${file.path}.`
        : `التمييز بين محتوى ${file.path} المحفوظ والصلة النظرية بالمفهوم دون افتراض تطبيق غير ظاهر.`,
      index === 3
        ? `ربط ${concept.name_en} بالمفهوم المدروس الآخر ${secondConcept.name_en}.`
        : `ذكر حالة عملية أو حدّ للتصميم مع تبرير يستند إلى سياق الملف المحفوظ.`,
    ];
    return newDefenseQuestion({
      index,
      question,
      concept: concept.name_en,
      file,
      difficulty: expectedDifficulty(index + 1),
      idealPoints: levelPoints,
      lessonContext: file.content.slice(0, 1_200),
      templateId: template.id,
    });
  });
}