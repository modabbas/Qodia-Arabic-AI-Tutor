import assert from "node:assert/strict";
import { test } from "node:test";
import { conceptAnchoringReport } from "./session-concept-validation.ts";

const concept = { name_en: "Dependency Management", name_ar: "مفهوم Flutter: Dependency Management" };
function lesson(reveal: string, build: string, question: string) {
  return {
    touch1_provoke: { question },
    touch2_reveal: { explanation: reveal, values_table: [] },
    touch3_explore: { question: "" },
    touch4_build: { task_description: build, expected_keywords: [] },
    touch5_defend: { committee_question: "" },
  };
}

test("dependency management accepts actual Flutter dependencies evidence", () => {
  const report = conceptAnchoringReport(lesson(
    "dependencies lists packages used by this application.",
    "Add provider to dependencies in pubspec.yaml.",
    "Why declare dependencies rather than copy third-party code?",
  ), concept);
  assert.deepEqual(report.failed_sections, []);
  assert.ok(report.matched_terms.reveal.includes("dependency"));
});

test("Arabic package questions remain valid concept assessments", () => {
  assert.deepEqual(conceptAnchoringReport(lesson(
    "ملف pubspec.yaml يحدد الحزم وإصداراتها.",
    "أضف provider إلى dependencies.",
    "كيف تمنع تعارض إصدارات الحزم في المشروع؟",
  ), concept).failed_sections, []);
});

test("generic unrelated content is still rejected despite a pinned concept title", () => {
  assert.deepEqual(conceptAnchoringReport(lesson(
    "Flutter builds user interfaces.", "Create a screen with a button.",
    "How do you change the screen color?",
  ), concept).failed_sections, ["reveal", "build", "assessment"]);
});

test("concept evidence must exist in every required section", () => {
  assert.deepEqual(conceptAnchoringReport(lesson(
    "Manage dependencies.", "Edit dependencies.",
    "What does setState do?",
  ), concept).failed_sections, ["assessment"]);
});

test("Arabic curriculum names preserve translated evidence rather than stripping it", () => {
  assert.deepEqual(conceptAnchoringReport(lesson(
    "الملاحة تنتقل بين الشاشات.", "استخدم الملاحة لفتح شاشة التفاصيل.",
    "كيف تعمل الملاحة بين الشاشات؟",
  ), { name_en: "Navigation", name_ar: "الملاحة بين الشاشات" }).failed_sections, []);
});