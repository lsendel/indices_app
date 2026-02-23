import { pgTable, uuid, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const zelutoConfigs = pgTable(
	'zeluto_configs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.unique()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').notNull(),
		userId: text('user_id').notNull(),
		userRole: text('user_role', { enum: ['owner', 'admin', 'member', 'viewer'] })
			.notNull()
			.default('admin'),
		plan: text('plan', { enum: ['free', 'starter', 'pro', 'enterprise'] })
			.notNull()
			.default('pro'),
		webhookSecret: text('webhook_secret'),
		webhookId: text('webhook_id'),
		active: boolean('active').notNull().default(true),
		metadata: jsonb('metadata').default({}).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index('zeluto_configs_tenant_idx').on(table.tenantId)],
)
