import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const engagementEvents = pgTable(
	'engagement_events',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		publishedContentId: uuid('published_content_id').notNull(),
		platform: text('platform').notNull(),
		eventType: text('event_type', {
			enum: ['view', 'like', 'share', 'comment', 'click', 'save', 'reply', 'conversion'],
		}).notNull(),
		count: integer('count').default(1).notNull(),
		metadata: jsonb('metadata').default({}).notNull(),
		recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('engagement_events_tenant_idx').on(table.tenantId),
		index('engagement_events_content_idx').on(table.publishedContentId),
		index('engagement_events_platform_idx').on(table.platform),
		index('engagement_events_type_idx').on(table.eventType),
		index('engagement_events_recorded_idx').on(table.recordedAt),
	],
)
