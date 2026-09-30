import { pgTable, primaryKey, text, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const generatedSessionsTable = pgTable(
  "generated_sessions",
  {
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    sessionDate: text("session_date").notNull(),
    payload: jsonb("payload").notNull().$type<unknown>(),
    previousConcepts: text("previous_concepts").array().notNull().default([]),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.sessionDate] })],
);