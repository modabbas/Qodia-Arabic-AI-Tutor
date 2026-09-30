import { createInsertSchema } from "drizzle-zod";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";
import { usersTable } from "./users";

export const projectFileStatusEnum = pgEnum("project_file_status", ["in_progress", "complete"]);

export const projectFilesTable = pgTable(
  "project_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    conceptNameEn: text("concept_name_en").notNull(),
    status: projectFileStatusEnum("status").notNull().default("in_progress"),
    completedSessionId: uuid("completed_session_id").references(() => sessionsTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("project_files_user_path_unique").on(table.userId, table.path),
    index("project_files_user_status_idx").on(table.userId, table.status),
  ],
);

export const insertProjectFileSchema = createInsertSchema(projectFilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProjectFile = z.infer<typeof insertProjectFileSchema>;
export type ProjectFile = typeof projectFilesTable.$inferSelect;