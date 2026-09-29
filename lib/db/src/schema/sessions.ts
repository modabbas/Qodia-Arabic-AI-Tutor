import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    concept: text("concept").notNull(),
    touchesCompleted: integer("touches_completed").notNull(),
    mistakes: integer("mistakes").notNull(),
    xpEarned: integer("xp_earned").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("sessions_user_timestamp_idx").on(table.userId, table.timestamp)],
);

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  timestamp: true,
});
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type LearningSession = typeof sessionsTable.$inferSelect;