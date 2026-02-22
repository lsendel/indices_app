import { pgTable, text, timestamp, uuid, jsonb, boolean, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  actor: text('actor').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_tenant').on(table.tenantId),
  index('idx_audit_created').on(table.createdAt),
  index('idx_audit_action').on(table.action),
])

export const webhooks = pgTable('webhooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: jsonb('events').default([]).notNull(),
  secret: text('secret').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
