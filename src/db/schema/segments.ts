import { pgTable, text, timestamp, uuid, jsonb, boolean, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const segments = pgTable('segments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  rules: jsonb('rules').default({}).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_segments_tenant').on(table.tenantId),
])

export const suppressionEntries = pgTable('suppression_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  entryType: text('entry_type', { enum: ['bounce', 'complaint', 'unsubscribe', 'manual'] }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_suppression_email').on(table.email),
  index('idx_suppression_tenant').on(table.tenantId),
])
