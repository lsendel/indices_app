import { pgTable, text, timestamp, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { user } from './auth'

export const tenantMembers = pgTable(
	'tenant_members',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['owner', 'admin', 'member'] })
			.default('owner')
			.notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex('tenant_members_user_tenant_idx').on(table.userId, table.tenantId),
		index('tenant_members_tenant_idx').on(table.tenantId),
	],
)
