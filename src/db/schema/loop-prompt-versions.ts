import { pgTable, uuid, text, timestamp, integer, real, index } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { tenants } from './tenants'

export const loopPromptVersions = pgTable('loop_prompt_versions', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	channel: text('channel').notNull(),
	channelGroup: text('channel_group'),
	systemPrompt: text('system_prompt').notNull(),
	instruction: text('instruction').notNull(),
	version: integer('version').notNull(),
	parentId: uuid('parent_id').references((): any => loopPromptVersions.id),
	strategy: text('strategy'),
	qualityScore: real('quality_score'),
	engagementScore: real('engagement_score'),
	status: text('status', { enum: ['candidate', 'active', 'retired', 'rejected'] }).default('candidate').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	activatedAt: timestamp('activated_at', { withTimezone: true }),
}, (table) => [
	index('idx_loop_prompts_active').on(table.tenantId, table.channel, table.status).where(sql`${table.status} = 'active'`),
	index('idx_loop_prompts_parent').on(table.parentId),
])
