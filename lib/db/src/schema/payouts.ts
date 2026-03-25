import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const payoutsTable = pgTable("payouts", {
  id:             serial("id").primaryKey(),
  serviceId:      text("service_id").notNull(),
  providerId:     text("provider_id").notNull(),
  paymentId:      text("payment_id"),
  totalAmount:    integer("total_amount").notNull(),
  platformFee:    integer("platform_fee").notNull(),
  providerAmount: integer("provider_amount").notNull(),
  status:         text("status").notNull().default("pending"),
  paidAt:         timestamp("paid_at",    { withTimezone: true }),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export type Payout    = typeof payoutsTable.$inferSelect;
export type NewPayout = typeof payoutsTable.$inferInsert;
