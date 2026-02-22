import { pgTable, text, timestamp, uuid, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const scrapedArticles = pgTable('scraped_articles', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	source: text('source', { enum: ['rss', 'news', 'web'] }).notNull(),
	title: text('title').notNull(),
	content: text('content'),
	url: text('url').notNull(),
	author: text('author'),
	contentHash: text('content_hash').notNull(),
	metadata: jsonb('metadata').default({}).notNull(),
	publishedAt: timestamp('published_at', { withTimezone: true }),
	scrapedAt: timestamp('scraped_at', { withTimezone: true }).defaultNow().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_scraped_articles_hash').on(table.contentHash),
	index('idx_scraped_articles_tenant').on(table.tenantId),
	index('idx_scraped_articles_source').on(table.source),
])

export const scrapedSocial = pgTable('scraped_social', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	platform: text('platform', { enum: ['reddit', 'linkedin', 'instagram'] }).notNull(),
	postId: text('post_id'),
	title: text('title'),
	content: text('content'),
	author: text('author'),
	url: text('url'),
	contentHash: text('content_hash').notNull(),
	engagement: jsonb('engagement').default({}).notNull(),
	subreddit: text('subreddit'),
	metadata: jsonb('metadata').default({}).notNull(),
	postedAt: timestamp('posted_at', { withTimezone: true }),
	scrapedAt: timestamp('scraped_at', { withTimezone: true }).defaultNow().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_scraped_social_hash').on(table.contentHash),
	index('idx_scraped_social_tenant').on(table.tenantId),
	index('idx_scraped_social_platform').on(table.platform),
])

export const scrapeJobs = pgTable('scrape_jobs', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	jobType: text('job_type', { enum: ['web_crawl', 'social_scrape', 'feed_ingest'] }).notNull(),
	status: text('status', { enum: ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled'] }).default('pending').notNull(),
	config: jsonb('config').default({}).notNull(),
	callbackUrl: text('callback_url').notNull(),
	pagesScraped: integer('pages_scraped').default(0).notNull(),
	errorMessage: text('error_message'),
	startedAt: timestamp('started_at', { withTimezone: true }),
	completedAt: timestamp('completed_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_scrape_jobs_tenant').on(table.tenantId),
	index('idx_scrape_jobs_status').on(table.status),
])
