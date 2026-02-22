import { pgTable, text, timestamp, uuid, jsonb, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const sentimentArticles = pgTable('sentiment_articles', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	source: text('source', { enum: ['rss', 'reddit', 'linkedin', 'instagram', 'news', 'web'] }).notNull(),
	title: text('title').notNull(),
	content: text('content'),
	url: text('url'),
	author: text('author'),
	brand: text('brand').notNull(),
	sentimentScore: real('sentiment_score').notNull(),
	sentimentLabel: text('sentiment_label', { enum: ['positive', 'neutral', 'negative'] }).notNull(),
	themes: jsonb('themes').default([]).notNull(),
	metadata: jsonb('metadata').default({}).notNull(),
	publishedAt: timestamp('published_at', { withTimezone: true }),
	analyzedAt: timestamp('analyzed_at', { withTimezone: true }).defaultNow().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_sentiment_tenant').on(table.tenantId),
	index('idx_sentiment_brand').on(table.brand),
	index('idx_sentiment_source').on(table.source),
	index('idx_sentiment_analyzed').on(table.analyzedAt),
])

export const driftEvents = pgTable('drift_events', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	brand: text('brand').notNull(),
	zScore: real('z_score').notNull(),
	direction: text('direction', { enum: ['positive', 'negative'] }).notNull(),
	baselineMean: real('baseline_mean').notNull(),
	currentMean: real('current_mean').notNull(),
	triggerArticles: jsonb('trigger_articles').default([]).notNull(),
	windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
	windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_drift_tenant').on(table.tenantId),
	index('idx_drift_brand').on(table.brand),
	index('idx_drift_created').on(table.createdAt),
])
