import { pgTable, text, timestamp, uuid, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const brandKits = pgTable('brand_kits', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	brandName: text('brand_name').notNull(),
	colors: jsonb('colors').default([]).notNull(),
	typography: jsonb('typography').default([]).notNull(),
	voiceAttributes: jsonb('voice_attributes').default({}).notNull(),
	logoRules: jsonb('logo_rules').default([]).notNull(),
	colorTolerance: integer('color_tolerance').default(50).notNull(),
	metadata: jsonb('metadata').default({}).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_brand_kits_tenant').on(table.tenantId),
])
