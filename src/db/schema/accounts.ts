import { pgTable, text, timestamp, uuid, jsonb, integer, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const accounts = pgTable('accounts', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	company: text('company').notNull(),
	domain: text('domain'),
	industry: text('industry'),
	size: text('size', { enum: ['1-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+'] }),
	score: integer('score').default(0).notNull(),
	tier: text('tier', { enum: ['enterprise', 'mid_market', 'smb', 'startup'] }).default('smb').notNull(),
	metadata: jsonb('metadata').default({}).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_accounts_tenant').on(table.tenantId),
	index('idx_accounts_company').on(table.company),
	index('idx_accounts_tier').on(table.tier),
	index('idx_accounts_score').on(table.score),
])

export const deals = pgTable('deals', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	value: real('value').notNull(),
	stage: text('stage', { enum: ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] }).default('discovery').notNull(),
	probability: integer('probability').default(0).notNull(),
	expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
	metadata: jsonb('metadata').default({}).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_deals_tenant').on(table.tenantId),
	index('idx_deals_account').on(table.accountId),
	index('idx_deals_stage').on(table.stage),
	index('idx_deals_created').on(table.createdAt),
])
