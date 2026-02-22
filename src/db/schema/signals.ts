import { pgTable, text, timestamp, uuid, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const signals = pgTable('signals', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	accountId: text('account_id').notNull(),
	signalType: text('signal_type', {
		enum: ['page_view', 'email_open', 'email_click', 'form_submit', 'demo_request', 'pricing_view', 'content_download', 'social_mention', 'competitor_visit', 'custom'],
	}).notNull(),
	signalSource: text('signal_source').notNull(),
	strength: integer('strength').notNull(),
	signalData: jsonb('signal_data').default({}).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_signals_tenant').on(table.tenantId),
	index('idx_signals_account').on(table.accountId),
	index('idx_signals_type').on(table.signalType),
	index('idx_signals_created').on(table.createdAt),
])

export const accountScores = pgTable('account_scores', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	accountId: text('account_id').notNull(),
	totalScore: integer('total_score').notNull().default(0),
	behavioralScore: integer('behavioral_score').notNull().default(0),
	demographicScore: integer('demographic_score').notNull().default(0),
	firmographicScore: integer('firmographic_score').notNull().default(0),
	level: text('level', { enum: ['hot', 'warm', 'cold', 'unqualified'] }).default('cold').notNull(),
	calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_account_scores_tenant').on(table.tenantId),
	index('idx_account_scores_account').on(table.accountId),
	index('idx_account_scores_level').on(table.level),
])
