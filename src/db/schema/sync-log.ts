import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const syncLogs = pgTable(
	'sync_logs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		syncType: text('sync_type', {
			enum: ['content', 'campaign', 'contact', 'experiment', 'webhook_registration'],
		}).notNull(),
		direction: text('direction', { enum: ['outbound', 'inbound'] })
			.notNull()
			.default('outbound'),
		status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] })
			.notNull()
			.default('pending'),
		resourceId: text('resource_id'),
		externalId: text('external_id'),
		metadata: jsonb('metadata').default({}).notNull(),
		error: text('error'),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('sync_logs_tenant_idx').on(table.tenantId),
		index('sync_logs_type_idx').on(table.syncType),
		index('sync_logs_status_idx').on(table.status),
	],
)
