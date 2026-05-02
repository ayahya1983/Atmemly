import { pgTable, serial, integer, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("audit_logs_user_idx").on(t.userId),
    entityIdx: index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    createdIdx: index("audit_logs_created_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLogsTable.$inferSelect;
