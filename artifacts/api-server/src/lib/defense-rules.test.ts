import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateDefense,
  canSaveDraftWithinGrace,
  getLockedAnswer,
  isCurrentEvaluationClaim,
  isIdenticalLockedAnswer,
  matchesSimulationOwner,
  newDefenseQuestion,
  privateSafeQuestion,
  professorForQuestion,
  questionElapsedSeconds,
  questionRemainingSeconds,
  summarizeEligibility,
  validGeneratedQuestion,
} from "./defense-rules.ts";
import { buildCuratedQuestions, curatedQuestionTemplates } from "./defense-question-bank.ts";
import { generatedQuestionValidationIssues } from "./defense-generation.ts";

const completedConcepts = Array.from({ length: 12 }, (_, index) => ({
  status: "completed",
  mastery_score: index * 5,
  name_en: `Concept ${index + 1}`,
  name_ar: `المفهوم ${index + 1}`,
}));
const completedFiles = [{
  path: "src/real-file.ts",
  content: "export const saved = true;",
  status: "complete",
}];

test("eligibility counts only completed concepts and actual nonempty complete files", () => {
  const summary = summarizeEligibility([
    ...completedConcepts.slice(0, 9),
    { status: "needs_review", mastery_score: 100, name_en: "Review", name_ar: "مراجعة" },
    { status: "planned", mastery_score: 100, name_en: "Planned", name_ar: "مخطط" },
  ], completedFiles);
  assert.equal(summary.completedConcepts, 9);
  assert.equal(summary.eligible, false);
  assert.equal(summary.averageMastery, 20);
  const missingCode = summarizeEligibility(completedConcepts, [{ ...completedFiles[0]!, content: "" }]);
  assert.equal(missingCode.eligible, false);
  assert.match(missingCode.warning ?? "", /ملفات مشروع مكتملة/);
  assert.equal(summarizeEligibility(completedConcepts, [{ ...completedFiles[0]!, status: "in_progress" }]).eligible, false);
});

test("question generation rotation and metadata require exact studied concepts and owned saved paths", () => {
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => professorForQuestion(i).professor),
    ["د. حسن", "د. فاطمة", "د. أحمد", "د. حسن", "د. فاطمة"]);
  const candidate = {
    question: "كيف يعمل Concept 1 في src/real-file.ts ولماذا اخترت هذا التصميم؟",
    concept_tested: "Concept 1",
    file_reference: "src/real-file.ts",
    ideal_answer_points: ["النقطة الأولى", "النقطة الثانية"],
  };
  assert.equal(validGeneratedQuestion(candidate, 1, completedConcepts, completedFiles), true);
  assert.equal(validGeneratedQuestion({ ...candidate, file_reference: "invented.ts" }, 1, completedConcepts, completedFiles), false);
  assert.equal(validGeneratedQuestion({ ...candidate, concept_tested: "unlearned" }, 1, completedConcepts, completedFiles), false);
  assert.equal(validGeneratedQuestion({ ...candidate, question: "سؤال لا يذكر الملف إطلاقاً" }, 1, completedConcepts, completedFiles), false);
  assert.equal(validGeneratedQuestion({ ...candidate, question: "سؤال عن الملف src/real-file.ts فقط" }, 1, completedConcepts, completedFiles), false);
});

test("grounded Arabic Gemini questions accept known Arabic aliases and link two studied concepts in question four", () => {
  const concepts = [
    ["State Management", "إدارة الحالة"],
    ["Component Composition", "تركيب المكونات"],
    ["Hooks", "الخطافات"],
    ["Context API", "واجهة سياق React"],
    ["Rendering", "العرض"],
    ["Props", "الخصائص"],
    ["Routing", "التوجيه"],
    ["Side Effects", "الآثار الجانبية"],
    ["Memoization", "حفظ النتائج"],
    ["Accessibility", "سهولة الوصول"],
  ].map(([name_en, name_ar]) => ({
    status: "completed",
    mastery_score: 80,
    name_en: name_en!,
    name_ar: name_ar!,
  }));
  const files = [
    { path: "src/state.ts", content: "export const state = { count: 0 };", status: "complete", conceptNameEn: "State Management" },
    { path: "src/routes.ts", content: "export const routes = [];", status: "complete", conceptNameEn: "Routing" },
    { path: "src/App.tsx", content: "export function App() { return null; }", status: "complete", conceptNameEn: "Hooks" },
  ];
  const questions = [
    {
      question_number: 1, difficulty: "basic", concept_tested: "State Management", file_reference: "src/state.ts",
      question: "اشرح مفهوم إدارة الحالة كما يظهر في src/state.ts، وما أثره على بيانات الواجهة؟",
      ideal_answer_points: ["وضوح الحالة", "تفسير ارتباطها بالواجهة"],
    },
    {
      question_number: 2, difficulty: "intermediate", concept_tested: "Routing", file_reference: "src/routes.ts",
      question: "كيف يمكن تقييم التوجيه في الملف src/routes.ts وما أثره في بنية التطبيق؟",
      ideal_answer_points: ["شرح مسارات التطبيق", "ذكر أثر التنظيم"],
    },
    {
      question_number: 3, difficulty: "intermediate", concept_tested: "Hooks", file_reference: "src/App.tsx",
      question: "كيف ستعالج الخطافات حالة تحميل بطيئة عند مراجعة src/App.tsx؟",
      ideal_answer_points: ["وصف حالة التحميل", "شرح تحديث الواجهة"],
    },
    {
      question_number: 4, difficulty: "advanced", concept_tested: "Hooks", file_reference: "src/App.tsx",
      question: "اربط الخطافات بتركيب المكونات، ثم ناقش علاقتهما بما يثبته الملف src/App.tsx فعلياً.",
      ideal_answer_points: ["توضيح المفهومين", "الاستناد إلى الملف المحفوظ"],
    },
    {
      question_number: 5, difficulty: "advanced", concept_tested: "Accessibility", file_reference: "src/App.tsx",
      question: "ما نقطة ضعف تصميمية محتملة عند مراجعة سهولة الوصول في src/App.tsx؟",
      ideal_answer_points: ["تحديد خطر قابل للفحص", "اقتراح تحسين قابل للتحقق"],
    },
  ];
  assert.deepEqual(generatedQuestionValidationIssues({ questions }, concepts, files), []);
  assert.deepEqual(
    generatedQuestionValidationIssues({
      questions: questions.map((question, index) => index === 3
        ? { ...question, concept_tested: "React Hooks + Component Composition" }
        : question),
    }, concepts, files),
    [],
  );
  assert.deepEqual(
    generatedQuestionValidationIssues({
      questions: questions.map((question, index) => index === 3
        ? { ...question, question: "ناقش الخطافات في src/App.tsx دون ذكر مفهوم مدروس ثانٍ." }
        : question),
    }, concepts, files),
    ["q4_q4_missing_second_studied_concept"],
  );
  assert.deepEqual(
    generatedQuestionValidationIssues({
      questions: questions.map((question, index) => index === 2
        ? { ...question, file_reference: "src/future-file.ts" }
        : question),
    }, concepts, files),
    ["q3_saved_file_reference"],
  );
  assert.deepEqual(
    generatedQuestionValidationIssues({
      questions: questions.map((question, index) => index === 1
        ? { ...question, difficulty: "advanced" }
        : question),
    }, concepts, files),
    ["q2_difficulty"],
  );
});

test("defense timers clamp elapsed and remaining time without client-provided deductions", () => {
  const start = new Date("2025-01-01T00:00:00.000Z");
  assert.equal(questionElapsedSeconds(start, new Date(start.getTime() - 10_000)), 0);
  assert.equal(questionElapsedSeconds(start, new Date(start.getTime() + 18_999)), 18);
  assert.equal(questionElapsedSeconds(start, new Date(start.getTime() + 90_000)), 60);
  assert.equal(questionRemainingSeconds(new Date(start.getTime() + 60_000), new Date(start.getTime() + 12_001)), 48);
  assert.equal(questionRemainingSeconds(new Date(start.getTime() - 1), start), 0);
});

test("two-second delivery grace accepts timer-edge payloads while clamping time at 60 seconds", () => {
  const question = newDefenseQuestion({
    index: 0,
    question: "اشرح المفهوم في src/real-file.ts مع مثال.",
    concept: "Concept 1",
    file: completedFiles[0]!,
    difficulty: "basic",
    idealPoints: ["واحد", "اثنان"],
    lessonContext: "excerpt",
    templateId: null,
  });
  question.draft = "آخر مسودة محفوظة";
  const started = new Date("2025-01-01T00:00:00.000Z");
  const deadline = new Date(started.getTime() + 60_000);
  assert.deepEqual(getLockedAnswer(question, "آخر نص مكتوب", new Date(deadline.getTime() + 1_999), started, deadline), {
    answer: "آخر نص مكتوب",
    timeUsed: 60,
    isExpired: false,
  });
  assert.equal(canSaveDraftWithinGrace(deadline, new Date(deadline.getTime() + 2_000)), true);
  assert.equal(canSaveDraftWithinGrace(deadline, new Date(deadline.getTime() + 2_001)), false);
  assert.deepEqual(getLockedAnswer(question, "آخر نص مكتوب", new Date(deadline.getTime() + 2_001), started, deadline), {
    answer: "آخر مسودة محفوظة",
    timeUsed: 60,
    isExpired: true,
  });
  assert.equal(isIdenticalLockedAnswer("آخر مسودة محفوظة", "إجابة معدلة بعد انتهاء الوقت"), false);
  assert.equal(isIdenticalLockedAnswer("آخر مسودة محفوظة", "آخر مسودة محفوظة"), true);
});

test("the response redacts ideal points and grading context until completed", () => {
  const question = newDefenseQuestion({
    index: 0,
    question: "اشرح المفهوم في src/real-file.ts مع مثال.",
    concept: "Concept 1",
    file: completedFiles[0]!,
    difficulty: "basic",
    idealPoints: ["secret grading point"],
    lessonContext: "private saved code excerpt",
    templateId: "private-template",
  });
  const beforeCompletion = privateSafeQuestion(question, false);
  assert.deepEqual(beforeCompletion.ideal_answer_points, []);
  assert.equal("lesson_context" in beforeCompletion, false);
  assert.equal("template_id" in beforeCompletion, false);
  assert.equal("evaluation_claim_token" in beforeCompletion, false);
  assert.deepEqual(privateSafeQuestion(question, true).ideal_answer_points, ["secret grading point"]);
});

test("evaluation claim tokens let only the current recovery attempt persist an outcome", () => {
  const question = newDefenseQuestion({
    index: 0,
    question: "اشرح المفهوم في src/real-file.ts مع مثال.",
    concept: "Concept 1",
    file: completedFiles[0]!,
    difficulty: "basic",
    idealPoints: ["واحد", "اثنان"],
    lessonContext: "",
    templateId: null,
  });
  question.evaluation_claim_token = "new-claim";
  assert.equal(isCurrentEvaluationClaim(question, "new-claim"), true);
  assert.equal(isCurrentEvaluationClaim(question, "expired-old-claim"), false);
});

test("completed simulation aggregation uses only genuine question scores, not time spent", () => {
  const questions = [60, 80, 90, 100, 40].map((points, index) => ({
    ...newDefenseQuestion({
      index,
      question: `سؤال ${index + 1} في src/real-file.ts`,
      concept: `Concept ${index + 1}`,
      file: completedFiles[0]!,
      difficulty: "advanced" as const,
      idealPoints: ["one", "two"],
      lessonContext: "",
      templateId: null,
    }),
    points,
    time_used_seconds: index === 0 ? 0 : 60,
    evaluation_status: "scored" as const,
  }));
  const result = aggregateDefense(questions);
  assert.equal(result.overallScore, 74);
  assert.deepEqual(result.weakConcepts, ["Concept 1", "Concept 5"]);
  assert.match(result.verdict, /74/);
  assert.throws(() => aggregateDefense(questions.slice(0, 4)), /DEFENSE_NOT_FULLY_SCORED/);
});

test("ownership gate fails closed for missing and another user's simulation metadata", () => {
  const row = { id: "sim-1", userId: "owner-1" };
  assert.equal(matchesSimulationOwner(row, "owner-1", "sim-1"), true);
  assert.equal(matchesSimulationOwner(row, "owner-2", "sim-1"), false);
  assert.equal(matchesSimulationOwner(row, "owner-1", "sim-2"), false);
  assert.equal(matchesSimulationOwner(null, "owner-1", "sim-1"), false);
});

test("curated fallback has exactly twenty distinct questions per supported stack and avoids recent templates", () => {
  const stacks = ["Django", "Node.js", "React", "Flutter"];
  for (const stack of stacks) {
    const templates = curatedQuestionTemplates(stack);
    assert.equal(templates.length, 20);
    assert.equal(new Set(templates.map((item) => item.id)).size, 20);
    assert.deepEqual([...new Set(templates.map((item) => item.level))], [1, 2, 3, 4, 5]);
    const questions = buildCuratedQuestions(stack, [
      ...completedConcepts,
      { status: "planned", mastery_score: null, name_en: "Not studied", name_ar: "غير مدروس" },
    ], completedFiles, new Set());
    assert.equal(questions.length, 5);
    assert.equal(questions.every((question) => question.question_text.includes(question.file_reference)), true);
    assert.equal(questions.every((question) => completedConcepts.some((concept) => concept.name_en === question.concept_tested)), true);
    const interlinked = questions[3]!;
    const linkedStudiedConcepts = completedConcepts.filter((concept) => interlinked.question_text.includes(concept.name_en));
    assert.equal(linkedStudiedConcepts.length >= 2, true);
    const recent = new Set(questions.map((question) => question.template_id).filter((id): id is string => id !== null));
    const next = buildCuratedQuestions(stack, completedConcepts, completedFiles, recent);
    assert.equal(next.every((question) => !recent.has(question.template_id ?? "")), true);
  }
});

test("curated questions pair a saved file with its associated studied concept when possible", () => {
  const associatedFile = {
    ...completedFiles[0]!,
    conceptNameEn: "Concept 8",
  };
  const questions = buildCuratedQuestions("React", completedConcepts, [associatedFile], new Set());
  assert.equal(questions.every((question) => question.concept_tested === "Concept 8"), true);
  assert.equal(questions.every((question) => question.question_text.includes("Concept 8")), true);
  assert.equal(questions[3]!.question_text.includes("Concept 1"), true);
});

test("unmatched saved-file concepts use neutral questions rather than claiming an unrelated concept is implemented", () => {
  const questions = buildCuratedQuestions("Django", completedConcepts, completedFiles, new Set());
  assert.match(questions[0]!.question_text, /دون افتراض تطبيق غير ظاهر/);
  assert.equal(questions[0]!.question_text.includes("في src/real-file.ts"), false);
});
