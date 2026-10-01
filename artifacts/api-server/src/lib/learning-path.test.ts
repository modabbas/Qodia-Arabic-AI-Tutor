import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateMasteryScore,
  completedProjectFileConcepts,
  conservativeLegacyTouchesCorrect,
  lessonExclusionNames,
  normalizeConceptName,
  reconcileHistoricalConcepts,
  seedHistoricalConcepts,
  selectNextConcept,
  validateCurriculum,
  type CurriculumConceptInput,
  type LearningConcept,
} from "./learning-path.ts";

function curriculumFixture(): CurriculumConceptInput[] {
  return Array.from({ length: 30 }, (_, index) => ({
    id: `concept_${index + 1}`,
    name_en: `Concept ${index + 1}`,
    name_ar: `مفهوم ${index + 1}`,
    category: "testing",
    difficulty: Math.min(5, Math.floor(index / 6) + 1),
    prerequisites: index === 0 ? [] : [`concept_${index}`],
    planned_day: index + 1,
    target_file: `file-${index + 1}.txt`,
    why_important: "Builds one verified project skill.",
  }));
}

function learningFixture(overrides: Partial<LearningConcept> = {}): LearningConcept {
  return {
    ...curriculumFixture()[0],
    status: "planned",
    mastery_score: null,
    last_reviewed: null,
    session_id: null,
    ...overrides,
  };
}

describe("learning-path validation and selection", () => {
  it("accepts a complete curriculum bound to its 30 planned files", () => {
    const files = curriculumFixture().map((concept) => ({
      path: concept.target_file,
      day: concept.planned_day,
      concept: concept.name_en,
      description: concept.why_important,
    }));
    assert.equal(validateCurriculum(curriculumFixture(), files).length, 30);
  });

  it("rejects duplicate names, invalid prerequisite order, and unmapped target files", () => {
    const files = curriculumFixture().map((concept) => ({
      path: concept.target_file,
      day: concept.planned_day,
      concept: concept.name_en,
      description: concept.why_important,
    }));
    const duplicateName = curriculumFixture();
    duplicateName[1] = { ...duplicateName[1]!, name_en: "concept-1" };
    assert.throws(() => validateCurriculum(duplicateName, files));
    const forwardEdge = curriculumFixture();
    forwardEdge[0] = { ...forwardEdge[0]!, prerequisites: ["concept_2"] };
    assert.throws(() => validateCurriculum(forwardEdge, files));
    const unknownTarget = curriculumFixture();
    unknownTarget[0] = { ...unknownTarget[0]!, target_file: "outside-plan.txt" };
    assert.throws(() => validateCurriculum(unknownTarget, files));
    const duplicateTarget = curriculumFixture();
    duplicateTarget[1] = { ...duplicateTarget[1]!, target_file: duplicateTarget[0]!.target_file };
    assert.throws(() => validateCurriculum(duplicateTarget, files));
  });

  it("matches only exact normalized historical concept names and seeds at 75", () => {
    const concepts = curriculumFixture().slice(0, 2);
    const seeded = seedHistoricalConcepts(concepts, [
      {
        concept: "Concept 1 — مفهوم 1",
        sessionId: "saved-session",
        timestamp: new Date("2025-01-01T00:00:00Z"),
        touchesCompleted: 5,
      },
      { concept: "Concept 10", sessionId: "not-a-match", timestamp: new Date("2025-01-02T00:00:00Z"), touchesCompleted: 5 },
    ]);
    assert.equal(seeded[0]?.status, "completed");
    assert.equal(seeded[0]?.mastery_score, 75);
    assert.equal(seeded[0]?.session_id, "saved-session");
    assert.equal(seeded[1]?.status, "planned");
    assert.equal(normalizeConceptName("Concept 1"), normalizeConceptName("concept-1"));
  });

  it("ignores partial history and reconciles completed files only by the owner's saved plan path", () => {
    const concepts = curriculumFixture();
    const files = concepts.map((concept) => ({
      path: concept.target_file,
      day: concept.planned_day,
      concept: concept.name_en,
      description: concept.why_important,
    }));
    const history = [
      {
        concept: "Concept 1 — مفهوم 1",
        sessionId: "partial-session",
        timestamp: new Date("2025-01-03T00:00:00Z"),
        touchesCompleted: 4,
      },
      {
        concept: "Unmapped Historical Concept",
        sessionId: "completed-session",
        timestamp: new Date("2025-01-04T00:00:00Z"),
        touchesCompleted: 5,
      },
    ];
    const fileHistory = completedProjectFileConcepts("owner-1", files, [{
      userId: "owner-1",
      path: "file-2.txt",
      conceptNameEn: "Saved File Concept",
      status: "complete",
      completedSessionId: null,
      updatedAt: new Date("2025-01-05T00:00:00Z"),
    }, {
      userId: "another-owner",
      path: "file-3.txt",
      conceptNameEn: "Other Owner Concept",
      status: "complete",
      completedSessionId: null,
      updatedAt: new Date("2025-01-05T00:00:00Z"),
    }]);

    const missingReservedName = curriculumFixture();
    assert.throws(() => validateCurriculum(missingReservedName, files, fileHistory));
    missingReservedName[1] = {
      ...missingReservedName[1]!,
      name_en: "Saved File Concept",
    };
    const validated = validateCurriculum(missingReservedName, files, fileHistory);
    const seeded = seedHistoricalConcepts(validated, history, fileHistory);
    assert.equal(seeded[0]?.status, "planned");
    assert.equal(seeded[0]?.mastery_score, null);
    assert.equal(seeded[1]?.status, "completed");
    assert.equal(seeded[1]?.mastery_score, 75);
    assert.equal(seeded[1]?.session_id, null);

    const reconciled = reconcileHistoricalConcepts(seeded, history, fileHistory);
    assert.equal(reconciled[0]?.status, "planned");
    assert.equal(reconciled[1]?.status, "completed");
    assert.equal(reconciled[1]?.name_en, "Saved File Concept");
    assert.throws(() => reconcileHistoricalConcepts(seeded.map((concept, index) => (
      index === 1 ? { ...concept, target_file: "wrong-path.txt" } : concept
    )), history, fileHistory));
  });

  it("keeps the latest completed review mastery on a file-backed concept across reconciliation", () => {
    const planFiles = curriculumFixture().map((concept) => ({
      path: concept.target_file,
      day: concept.planned_day,
      concept: concept.name_en,
      description: concept.why_important,
    }));
    const savedFiles = [{
      userId: "owner-1",
      path: "file-1.txt",
      conceptNameEn: "Concept 1",
      status: "complete",
      completedSessionId: "original-lesson",
      updatedAt: new Date("2025-01-01T12:00:00Z"),
    }];
    const completedFiles = completedProjectFileConcepts("owner-1", planFiles, savedFiles);
    const originalLesson = {
      concept: "Concept 1 — مفهوم 1",
      sessionId: "original-lesson",
      timestamp: new Date("2025-01-01T12:00:00Z"),
      touchesCompleted: 5,
      masteryEarned: 40,
    };
    const successfulReview = {
      concept: "Concept 1 — مفهوم 1",
      sessionId: "review-lesson",
      timestamp: new Date("2025-01-02T12:00:00Z"),
      touchesCompleted: 5,
      masteryEarned: 85,
    };
    const initial = seedHistoricalConcepts(curriculumFixture().slice(0, 2), [originalLesson], completedFiles);
    assert.equal(initial[0]?.status, "needs_review");
    assert.equal(initial[0]?.mastery_score, 40);

    const once = reconcileHistoricalConcepts(initial, [originalLesson, successfulReview], completedFiles);
    const twice = reconcileHistoricalConcepts(once, [originalLesson, successfulReview], completedFiles);
    assert.equal(twice[0]?.mastery_score, 85);
    assert.equal(twice[0]?.status, "completed");
    assert.equal(twice[0]?.session_id, "review-lesson");
    assert.equal(selectNextConcept(twice, new Date("2025-01-03T12:00:00Z"))?.concept.id, "concept_2");
    assert.equal(savedFiles[0]?.completedSessionId, "original-lesson");
  });

  it("retains all historical names as exclusions beyond the 30-concept map", () => {
    const history = Array.from({ length: 40 }, (_, index) => `Historical Concept ${index + 1}`);
    const exclusions = lessonExclusionNames(history, ["Mapped Complete Concept"], ["Prior Cached Concept"], "Historical Concept 1");
    assert.equal(exclusions.length, 41);
    assert.equal(exclusions.includes("Historical Concept 1"), false);
    assert.equal(exclusions.includes("Historical Concept 40"), true);
    assert.equal(exclusions.includes("Mapped Complete Concept"), true);
  });

  it("prioritizes the in-progress lesson and does not turn a planned prerequisite into a review", () => {
    const first = learningFixture({ id: "first", name_en: "First" });
    const second = learningFixture({
      id: "second",
      name_en: "Second",
      planned_day: 2,
      prerequisites: ["first"],
    });
    assert.equal(selectNextConcept([first, second], new Date())?.concept.id, "first");

    const lockedByPlanned = learningFixture({
      id: "third",
      name_en: "Third",
      planned_day: 3,
      prerequisites: ["first"],
    });
    assert.equal(selectNextConcept([lockedByPlanned], new Date()), null);

    const lowMasteryPrerequisite = learningFixture({
      id: "first",
      name_en: "First",
      status: "needs_review",
      mastery_score: 50,
      last_reviewed: "2025-04-01T12:00:00.000Z",
    });
    const dependent = learningFixture({
      id: "second",
      name_en: "Second",
      planned_day: 2,
      prerequisites: ["first"],
    });
    const earlyReview = selectNextConcept([lowMasteryPrerequisite, dependent], new Date("2025-04-01T12:30:00.000Z"));
    assert.equal(earlyReview?.isReview, true);
    assert.equal(earlyReview?.concept.id, "first");
  });

  it("selects due reviews after three days and can suppress an early repeat in the same day", () => {
    const needsReview = learningFixture({
      status: "needs_review",
      mastery_score: 45,
      last_reviewed: "2025-01-01T12:00:00.000Z",
    });
    const now = new Date("2025-01-04T12:00:00.000Z");
    assert.equal(selectNextConcept([needsReview], now)?.isReview, true);
    assert.equal(selectNextConcept([needsReview], now, new Set([needsReview.id])), null);
    assert.equal(selectNextConcept([needsReview], new Date("2025-01-03T11:59:59.000Z")), null);
  });

  it("bounds mastery and conservative telemetry", () => {
    assert.equal(calculateMasteryScore(4, 8, true), 95);
    assert.equal(calculateMasteryScore(9, 8, true), 100);
    assert.equal(calculateMasteryScore(5, 10, false), 100);
    assert.equal(conservativeLegacyTouchesCorrect(5, 0), 4);
    assert.equal(conservativeLegacyTouchesCorrect(3, 9), 0);
  });
});