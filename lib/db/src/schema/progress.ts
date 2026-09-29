import { date, integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const progressTable = pgTable("progress", {
  userId: uuid("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  totalXp: integer("total_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streakDays: integer("streak_days").notNull().default(0),
  lastActive: date("last_active", { mode: "string" }),
});

export const insertProgressSchema = createInsertSchema(progressTable).omit({
  totalXp: true,
  level: true,
  streakDays: true,
  lastActive: true,
});
export type InsertProgress = z.infer<typeof insertProgressSchema>;
export type Progress = typeof progressTable.$inferSelect;