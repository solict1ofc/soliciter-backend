import { integer, serial, text, timestamp, pgTable } from "drizzle-orm/pg-core";

export const withdrawalsTable = pgTable("withdrawals", {
  id:         serial("id").primaryKey(),
  userId:     text("user_id").notNull(),
  amount:     integer("amount").notNull(),
  method:     text("method").notNull().default("pix"),
  pixKey:     text("pix_key"),
  bankHolder: text("bank_holder"),
  bankCpf:    text("bank_cpf"),
  bankName:   text("bank_name"),
  bankAgency: text("bank_agency"),
  bankAccount:text("bank_account"),
  bankType:   text("bank_type"),
  status:     text("status").notNull().default("pending"),
  processedAt:timestamp("processed_at", { withTimezone: true }),
  createdAt:  timestamp("created_at", { withTimezone: true }).defaultNow(),
});
