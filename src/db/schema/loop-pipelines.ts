import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const loopPipelines = pgTable('loop_pipelines', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	eventType: text('event_type').notNull(),
	config: jsonb('config').default({}).notNull(),
	active: boolean('active').default(true).notNull(),
	lastRunAt: timestamp('last_run_at', { withTimezone: true }),
	runCount: integer('run_count').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_loop_pipelines_tenant').on(table.tenantId),
	index('idx_loop_pipelines_event').on(table.eventType),
])
