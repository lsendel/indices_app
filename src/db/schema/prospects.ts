import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const prospects = pgTable('prospects', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  company: text('company').notNull(),
  role: text('role').notNull(),
  email: text('email'),
  phone: text('phone'),
  linkedinId: text('linkedin_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_prospects_email').on(table.email),
  index('idx_prospects_tenant').on(table.tenantId),
  index('idx_prospects_company').on(table.company),
])
