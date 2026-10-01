import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  additionalXpForProgress,
  findOwnedGeneratedLesson,
  findOwnedUnfinishedLessonById,
  selectOwnedUnfinishedLesson,
} from "./lesson-cache.ts";

describe("cross-date lesson cache identity", () => {
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