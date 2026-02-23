import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const platformConnections = pgTable(
	'platform_connections',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		platform: text('platform', {
			enum: ['instagram', 'facebook', 'whatsapp', 'tiktok', 'linkedin', 'wordpress', 'blog'],
		}).notNull(),
		accessToken: text('access_token').notNull(),
		refreshToken: text('refresh_token'),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		scopes: text('scopes'),
		metadata: jsonb('metadata').default({}).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('platform_connections_tenant_idx').on(table.tenantId),
		index('platform_connections_platform_idx').on(table.platform),
	],
)
