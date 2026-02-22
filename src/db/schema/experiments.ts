import { pgTable, text, timestamp, uuid, jsonb, real, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const experiments = pgTable('experiments', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	type: text('type', { enum: ['ab_test', 'mab_thompson', 'mab_ucb', 'mab_epsilon'] }).default('ab_test').notNull(),
	status: text('status', { enum: ['draft', 'running', 'paused', 'completed'] }).default('draft').notNull(),
	targetMetric: text('target_metric').notNull(),
	winnerId: uuid('winner_id'),
	metadata: jsonb('metadata').default({}).notNull(),
	startedAt: timestamp('started_at', { withTimezone: true }),
	endedAt: timestamp('ended_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_experiments_tenant').on(table.tenantId),
	index('idx_experiments_status').on(table.status),
])

export const experimentArms = pgTable('experiment_arms', {
	id: uuid('id').defaultRandom().primaryKey(),
	experimentId: uuid('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
	variantName: text('variant_name').notNull(),
	content: jsonb('content').default({}).notNull(),
	alpha: real('alpha').default(1).notNull(),
	beta: real('beta').default(1).notNull(),
	trafficPct: real('traffic_pct').default(0).notNull(),
	impressions: integer('impressions').default(0).notNull(),
	conversions: integer('conversions').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_arms_experiment').on(table.experimentId),
])
