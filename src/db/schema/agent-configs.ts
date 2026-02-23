import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const agentConfigs = pgTable('agent_configs', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description').notNull(),
	systemPrompt: text('system_prompt').notNull(),
	instructionPrompt: text('instruction_prompt').notNull(),
	inputs: jsonb('inputs').default([]).notNull(),
	outputs: jsonb('outputs').default([]).notNull(),
	metadata: jsonb('metadata').default({}).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_agent_configs_tenant').on(table.tenantId),
])
