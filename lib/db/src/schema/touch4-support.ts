import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export type StoredTouch4Hint = {
  level: 1 | 2 | 3;
  type: "guidance" | "similar_example" | "partial_solution";
  text_ar: string;
  example?: string;
  code_example?: string;
};

export type StoredTouch4Bundle = {
  hints: [StoredTouch4Hint, StoredTouch4Hint, StoredTouch4Hint];
  reference_solution: string;
};

export const touch4SupportTable = pgTable(
  "touch4_support",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id").notNull(),
    attempts: integer("attempts").notNull().default(0),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    hintsUsed: integer("hints_used").notNull().default(0),
    failuresAtLastHint: integer("failures_at_last_hint").notNull().default(0),
    solutionViewed: boolean("solution_viewed").notNull().default(false),
    firstTryBonus: integer("first_try_bonus").notNull().default(0),
    buildSaved: boolean("build_saved").notNull().default(false),
    revealedHints: jsonb("revealed_hints").$type<StoredTouch4Hint[]>().notNull().default([]),
    bundle: jsonb("bundle").$type<StoredTouch4Bundle>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("touch4_support_user_lesson_unique").on(table.userId, table.lessonId)],
);

export const insertTouch4SupportSchema = createInsertSchema(touch4SupportTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTouch4Support = z.infer<typeof insertTouch4SupportSchema>;
export type Touch4Support = typeof touch4SupportTable.$inferSelect;