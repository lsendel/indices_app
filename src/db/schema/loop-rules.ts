import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants'

export const loopRules = pgTable('loop_rules', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	conditions: jsonb('conditions').notNull(),
	actions: jsonb('actions').notNull(),
	scope: jsonb('scope').default({}).notNull(),
	priority: integer('priority').default(50).notNull(),
	cooldownMinutes: integer('cooldown_minutes').default(0).notNull(),
	lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
	fireCount: integer('fire_count').default(0).notNull(),
	active: boolean('active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_loop_rules_tenant_active').on(table.tenantId, table.active).where(sql`${table.active} = true`),
])
