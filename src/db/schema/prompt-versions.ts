import { pgTable, text, timestamp, uuid, integer, real, boolean, index } from 'drizzle-orm/pg-core'
import { agentConfigs } from './agent-configs'

export const promptVersions = pgTable('prompt_versions', {
	id: uuid('id').defaultRandom().primaryKey(),
	agentConfigId: uuid('agent_config_id').notNull().references(() => agentConfigs.id, { onDelete: 'cascade' }),
	version: integer('version').notNull(),
	systemPrompt: text('system_prompt').notNull(),
	instructionPrompt: text('instruction_prompt').notNull(),
	score: real('score'),
	isActive: boolean('is_active').default(false).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_prompt_versions_agent').on(table.agentConfigId),
	index('idx_prompt_versions_version').on(table.agentConfigId, table.version),
])

export const promptGradients = pgTable('prompt_gradients', {
	id: uuid('id').defaultRandom().primaryKey(),
	promptVersionId: uuid('prompt_version_id').notNull().references(() => promptVersions.id, { onDelete: 'cascade' }),
	gradient: text('gradient').notNull(),
	loss: real('loss').notNull(),
	improvementSuggestion: text('improvement_suggestion'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_prompt_gradients_version').on(table.promptVersionId),
])
