import { pgTable, uuid, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants'

export const loopChannelGroups = pgTable('loop_channel_groups', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	type: text('type', { enum: ['static', 'behavioral', 'audience'] }).notNull(),
	channels: text('channels').array().notNull(),
	criteria: jsonb('criteria'),
	autoRefresh: boolean('auto_refresh').default(false).notNull(),
	refreshedAt: timestamp('refreshed_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_channel_groups_tenant').on(table.tenantId),
	index('idx_channel_groups_refresh').on(table.tenantId, table.autoRefresh).where(sql`${table.autoRefresh} = true`),
])
