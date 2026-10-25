import { sql } from "drizzle-orm";
import { check, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const storeProjectsTable = pgTable("store_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar").notNull(),
  techStack: text("tech_stack").notNull(),
  difficulty: text("difficulty").notNull(),
  priceStudentUsd: integer("price_student_usd").notNull(),
  priceInstituteUsd: integer("price_institute_usd").notNull(),
  includes: jsonb("includes").$type<string[]>().notNull(),
  images: jsonb("images").$type<string[]>().notNull().default([]),
  status: text("status").$type<"draft" | "coming_soon" | "available">().notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("store_student_price_range", sql`${table.priceStudentUsd} BETWEEN 150 AND 350`),
  check("store_institute_price_min", sql`${table.priceInstituteUsd} >= 200`),
  check("store_project_status", sql`${table.status} IN ('draft', 'coming_soon', 'available')`),
  check("store_project_difficulty", sql`${table.difficulty} IN ('مبتدئ', 'متوسط', 'متقدم')`),
]);

export const insertStoreProjectSchema = createInsertSchema(storeProjectsTable).omit({ id: true, createdAt: true });
export type InsertStoreProject = z.infer<typeof insertStoreProjectSchema>;
export type StoreProject = typeof storeProjectsTable.$inferSelect;
