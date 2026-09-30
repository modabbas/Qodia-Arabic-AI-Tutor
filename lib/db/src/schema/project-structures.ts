import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export type ProjectPlanEntry = {
  path: string;
  day: number;
  concept: string;
  description: string;
};

export const projectStructuresTable = pgTable("project_structures", {
  userId: uuid("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  projectName: text("project_name").notNull(),
  techStack: text("tech_stack").notNull(),
  projectSummary: text("project_summary").notNull(),
  files: jsonb("files").notNull().$type<ProjectPlanEntry[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectStructureSchema = createInsertSchema(projectStructuresTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertProjectStructure = z.infer<typeof insertProjectStructureSchema>;
export type ProjectStructure = typeof projectStructuresTable.$inferSelect;