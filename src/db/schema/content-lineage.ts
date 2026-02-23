import { pgTable, uuid, text, timestamp, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { loopPromptVersions } from './loop-prompt-versions'

export const contentLineage = pgTable('content_lineage', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	promptVersionId: uuid('prompt_version_id').notNull().references(() => loopPromptVersions.id),
	publishedContentId: uuid('published_content_id'),
	campaignId: uuid('campaign_id'),
	experimentArmId: uuid('experiment_arm_id'),
	channel: text('channel').notNull(),
	generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
	engagementScore: real('engagement_score'),
	engagementUpdatedAt: timestamp('engagement_updated_at', { withTimezone: true }),
}, (table) => [
	index('idx_lineage_content').on(table.publishedContentId),
	index('idx_lineage_prompt').on(table.promptVersionId),
	index('idx_lineage_tenant').on(table.tenantId),
])
