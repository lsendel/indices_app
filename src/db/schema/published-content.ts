import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const publishedContent = pgTable(
	'published_content',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		platform: text('platform').notNull(),
		channel: text('channel').notNull(),
		platformContentId: text('platform_content_id'),
		platformUrl: text('platform_url'),
		content: jsonb('content').notNull(),
		status: text('status', {
			enum: ['draft', 'published', 'scheduled', 'processing', 'failed', 'deleted'],
		})
			.default('draft')
			.notNull(),
		publishedAt: timestamp('published_at', { withTimezone: true }),
		campaignId: uuid('campaign_id'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('published_content_tenant_idx').on(table.tenantId),
		index('published_content_platform_idx').on(table.platform),
		index('published_content_campaign_idx').on(table.campaignId),
		index('published_content_status_idx').on(table.status),
	],
)
