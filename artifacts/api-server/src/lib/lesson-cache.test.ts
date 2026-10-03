import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  additionalXpForProgress,
  findOwnedGeneratedLesson,
  findOwnedUnfinishedLessonById,
  selectOwnedUnfinishedLesson,
  isSupersededEarlyReview,
} from "./lesson-cache.ts";
import { seedHistoricalConcepts } from "./learning-path.ts";

const concepts = seedHistoricalConcepts([1, 2].map(day => ({
  id: `concept_${day}`, name_en: `Concept ${day}`, name_ar: `مفهوم ${day}`,
  category: "basics", difficulty: 1, prerequisites: day === 1 ? [] : ["concept_1"],
  planned_day: day, target_file: `file-${day}.ts`, why_important: "Plan order",
})), [{
  concept: "Concept 1", conceptId: "concept_1", sessionId: "completed",
  timestamp: new Date("2026-10-04T10:00:00Z"), touchesCompleted: 5, masteryEarned: 45,
}]);

describe("cross-date lesson cache identity", () => {
  it("skips an old teaching cache after the concept completed under a different lesson", () => {
    const old = {
      userId: "owner", sessionDate: "2026-10-03",
      payload: { lesson_id: "orphan", concept_id: "concept_1", concept_name_en: "Concept 1", is_review: false },
      updatedAt: new Date("2026-10-03"),
    };
    const next = {
      ...old, sessionDate: "2026-10-04",
      payload: { lesson_id: "next", concept_id: "concept_2", concept_name_en: "Concept 2", is_review: false },
    };
    const sessions = [{ userId: "owner", lessonId: "completed", conceptId: "concept_1",
      concept: "Concept 1", touchesCompleted: 5 }];
    assert.equal(selectOwnedUnfinishedLesson([old], [], "owner", concepts), null);
    assert.equal(selectOwnedUnfinishedLesson([old], sessions, "owner"), null);
    assert.equal(selectOwnedUnfinishedLesson([old, next], sessions, "owner", concepts), next);
    assert.equal(selectOwnedUnfinishedLesson([old], [{ ...sessions[0]!, userId: "other" }], "owner"), old);
    assert.equal(selectOwnedUnfinishedLesson([old], [{ ...sessions[0]!, touchesCompleted: 4 }], "owner"), old);
    const review = { ...old, payload: { ...old.payload, is_review: true } };
    assert.equal(selectOwnedUnfinishedLesson([review], sessions, "owner", concepts), review);
  });

  it("supersedes only unstarted early reinforcement when the next new concept is available", () => {
    const earlyReview = { is_review: true, concept_id: "concept_1", review_reason: "مراجعة تعزيز مبكرة لأن إتقان هذا المتطلب يمنع فتح مفاهيم الخطة التالية." };
    const now = new Date("2026-10-04T10:30:00Z");
    assert.equal(isSupersededEarlyReview(earlyReview, concepts, now, false), true);
    assert.equal(isSupersededEarlyReview(earlyReview, concepts, now, true), false);
    assert.equal(isSupersededEarlyReview({ ...earlyReview, review_reason: "مراجعة متباعدة" }, concepts, now, false), false);
    assert.equal(isSupersededEarlyReview(earlyReview, concepts, new Date("2026-10-07T10:30:00Z"), false), false);
  });

  it("resumes the same owned unfinished lesson across dates and ignores another owner's cache", () => {
    const earlier = {
      userId: "owner",
      sessionDate: "2025-04-01",
      payload: { lesson_id: "unfinished-lesson" },
      updatedAt: new Date("2025-04-01T23:59:00Z"),
      expiresAt: new Date("2025-04-02T00:00:00Z"),
    };
    const newerOtherOwner = {
      userId: "other-owner",
      sessionDate: "2025-04-02",
      payload: { lesson_id: "other-lesson" },
      updatedAt: new Date("2025-04-02T00:01:00Z"),
    };
    const newerCompleted = {
      userId: "owner",
      sessionDate: "2025-04-02",
      payload: { lesson_id: "completed-lesson" },
      updatedAt: new Date("2025-04-02T00:02:00Z"),
    };
    const rows = [earlier, newerOtherOwner, newerCompleted];
    const sessions = [
      { userId: "owner", lessonId: "unfinished-lesson", touchesCompleted: 3 },
      { userId: "owner", lessonId: "completed-lesson", touchesCompleted: 5 },
      { userId: "other-owner", lessonId: "other-lesson", touchesCompleted: 0 },
    ];

    assert.equal(selectOwnedUnfinishedLesson(rows, sessions, "owner"), earlier);
    assert.equal(findOwnedGeneratedLesson(rows, "owner", "unfinished-lesson"), earlier);
    assert.equal(findOwnedUnfinishedLessonById(rows, sessions, "owner", "unfinished-lesson"), earlier);
    assert.equal(findOwnedUnfinishedLessonById(rows, sessions, "owner", "completed-lesson"), null);
    assert.equal(findOwnedGeneratedLesson(rows, "owner", "other-lesson"), null);
  });

  it("does not award XP twice for a replay and awards only the incremental difference", () => {
    assert.equal(additionalXpForProgress(60, 60), 0);
    assert.equal(additionalXpForProgress(40, 80), 40);
    assert.equal(additionalXpForProgress(100, 80), 0);
  });
});