import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const deliveryEvents = pgTable(
	'delivery_events',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		zelutoJobId: text('zeluto_job_id'),
		campaignId: uuid('campaign_id'),
		experimentId: uuid('experiment_id'),
		contactEmail: text('contact_email'),
		channel: text('channel', { enum: ['email', 'sms', 'push', 'webhook'] }).notNull(),
		eventType: text('event_type', {
			enum: [
				'queued',
				'sent',
				'delivered',
				'opened',
				'clicked',
				'bounced',
				'complained',
				'unsubscribed',
				'failed',
			],
		}).notNull(),
		providerMessageId: text('provider_message_id'),
		eventData: jsonb('event_data').default({}).notNull(),
		occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('delivery_events_tenant_idx').on(table.tenantId),
		index('delivery_events_campaign_idx').on(table.campaignId),
		index('delivery_events_experiment_idx').on(table.experimentId),
		index('delivery_events_type_idx').on(table.eventType),
		index('delivery_events_occurred_idx').on(table.occurredAt),
	],
)
