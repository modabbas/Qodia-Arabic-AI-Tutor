import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type LearningConceptStatus = "planned" | "in_progress" | "completed" | "needs_review";

export type StoredLearningConcept = {
  id: string;
  name_en: string;
  name_ar: string;
  category: string;
  difficulty: number;
  prerequisites: string[];
  planned_day: number;
  target_file: string;
  why_important: string;
  status: LearningConceptStatus;
  mastery_score: number | null;
  last_reviewed: string | null;
  session_id: string | null;
  encounter_count?: number;
};

export const learningMapsTable = pgTable("learning_map", {
  userId: uuid("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  projectName: text("project_name").notNull(),
  techStack: text("tech_stack").notNull(),
  concepts: jsonb("concepts").notNull().$type<StoredLearningConcept[]>(),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type LearningMap = typeof learningMapsTable.$inferSelect;