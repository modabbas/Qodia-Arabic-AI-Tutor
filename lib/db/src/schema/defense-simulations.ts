import { createInsertSchema } from "drizzle-zod";
import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { usersTable } from "./users";

export type DefenseEvaluationStatus = "unanswered" | "pending" | "failed" | "scored";
export type DefenseDifficulty = "basic" | "intermediate" | "advanced";

export type StoredDefenseQuestion = {
  question_number: number;
  professor: string;
  role: string;
  question_text: string;
  difficulty: DefenseDifficulty;
  concept_tested: string;
  file_reference: string;
  time_limit_seconds: 60;
  student_answer: string | null;
  draft: string;
  answered_at: string | null;
  points: number | null;
  time_used_seconds: number | null;
  evaluation_status: DefenseEvaluationStatus;
  strengths: string[];
  weaknesses: string[];
  professor_reaction: string | null;
  mini_feedback: string | null;
  would_pass: boolean | null;
  ideal_answer_points: string[];
  lesson_context: string;
  template_id: string | null;
  evaluation_started_at?: string | null;
  evaluation_claim_token?: string | null;
};

export const defenseSimulationsTable = pgTable(
  "defense_simulations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    projectName: text("project_name").notNull(),
    techStack: text("tech_stack").notNull(),
    status: text("status").notNull().default("active"),
    source: text("source").notNull(),
    questions: jsonb("questions").$type<StoredDefenseQuestion[]>().notNull(),
    currentIndex: integer("current_index").notNull().default(0),
    currentQuestionStartedAt: timestamp("current_question_started_at", { withTimezone: true }),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }),
    overallScore: integer("overall_score"),
    verdict: text("verdict"),
    weakConcepts: text("weak_concepts").array().notNull().default(sql`ARRAY[]::text[]`),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("defense_simulations_user_started_idx").on(table.userId, table.startedAt),
    uniqueIndex("defense_simulations_one_active_user_unique").on(table.userId)
      .where(sql`${table.status} = 'active'`),
  ],
);

export const insertDefenseSimulationSchema = createInsertSchema(defenseSimulationsTable).omit({
  id: true,
  startedAt: true,
  updatedAt: true,
});
export type InsertDefenseSimulation = z.infer<typeof insertDefenseSimulationSchema>;
export type DefenseSimulation = typeof defenseSimulationsTable.$inferSelect;