import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const loopEvents = pgTable('loop_events', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	eventType: text('event_type').notNull(),
	payload: jsonb('payload').notNull(),
	pipelineId: uuid('pipeline_id'),
	ruleIds: uuid('rule_ids').array(),
	outcome: text('outcome', { enum: ['processed', 'gated', 'error', 'skipped'] }).notNull(),
	outcomeData: jsonb('outcome_data'),
	durationMs: integer('duration_ms'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_loop_events_tenant_time').on(table.tenantId, table.createdAt),
	index('idx_loop_events_type').on(table.eventType),
])
