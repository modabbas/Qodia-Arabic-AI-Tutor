import { boolean, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const lessonSubmissionsTable = pgTable(
  "lesson_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").notNull(),
    targetFile: text("target_file").notNull(),
    isReview: boolean("is_review").notNull().default(false),
    firstAttemptPassed: boolean("first_attempt_passed").notNull().default(false),
    submissionCount: integer("submission_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("lesson_submissions_user_lesson_unique").on(table.userId, table.lessonId)],
);

export const reviewExercisesTable = pgTable(
  "review_exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").notNull(),
    conceptId: text("concept_id").notNull(),
    targetFile: text("target_file").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("review_exercises_user_lesson_unique").on(table.userId, table.lessonId)],
);