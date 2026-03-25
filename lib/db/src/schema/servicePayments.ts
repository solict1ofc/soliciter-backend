import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const servicePaymentsTable = pgTable("service_payments", {
  serviceId: text("service_id").primaryKey(),
  paymentId: text("payment_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("pending"),
  pixCode: text("pix_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
});

export type ServicePayment = typeof servicePaymentsTable.$inferSelect;
export type NewServicePayment = typeof servicePaymentsTable.$inferInsert;
