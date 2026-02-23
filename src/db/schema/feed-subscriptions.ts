import { pgTable, text, timestamp, uuid, integer, boolean, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const feedSubscriptions = pgTable('feed_subscriptions', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	feedUrl: text('feed_url').notNull(),
	feedType: text('feed_type', { enum: ['rss', 'atom', 'news'] }).default('rss').notNull(),
	schedule: text('schedule').default('0 */6 * * *').notNull(),
	active: boolean('active').default(true).notNull(),
	keywords: text('keywords'),
	maxItems: integer('max_items').default(50).notNull(),
	lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
	lastContentHash: text('last_content_hash'),
	errorCount: integer('error_count').default(0).notNull(),
	lastError: text('last_error'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_feed_subs_tenant').on(table.tenantId),
	index('idx_feed_subs_active').on(table.active),
])
