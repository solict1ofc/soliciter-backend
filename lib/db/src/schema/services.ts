import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const servicesTable = pgTable("services", {
  serviceId: text("service_id").primaryKey(),
  status: text("status").notNull().default("em_andamento"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export type ServiceRecord = typeof servicesTable.$inferSelect;
export type NewServiceRecord = typeof servicesTable.$inferInsert;
