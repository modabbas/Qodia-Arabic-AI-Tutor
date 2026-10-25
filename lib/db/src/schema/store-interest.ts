import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { storeProjectsTable } from "./store-projects";

export const storeInterestTable = pgTable("store_interest", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => storeProjectsTable.id),
  name: text("name").notNull(),
  emailOrPhone: text("email_or_phone").notNull(),
  contactNormalized: text("contact_normalized").notNull(),
  type: text("type").$type<"student" | "institute">().notNull(),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("store_interest_project_contact_unique").on(table.projectId, table.contactNormalized),
  check("store_interest_type", sql`${table.type} IN ('student', 'institute')`),
]);

export const insertStoreInterestSchema = createInsertSchema(storeInterestTable).omit({ id: true, createdAt: true });
export type InsertStoreInterest = z.infer<typeof insertStoreInterestSchema>;
export type StoreInterest = typeof storeInterestTable.$inferSelect;
