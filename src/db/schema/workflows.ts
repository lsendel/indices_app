import { pgTable, text, timestamp, uuid, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const workflows = pgTable('workflows', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	goal: text('goal').notNull(),
	status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'paused'] }).default('pending').notNull(),
	campaignId: uuid('campaign_id'),
	metadata: jsonb('metadata').default({}).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_workflows_tenant').on(table.tenantId),
	index('idx_workflows_status').on(table.status),
])

export const workflowNodes = pgTable('workflow_nodes', {
	id: uuid('id').defaultRandom().primaryKey(),
	workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description').notNull(),
	status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'awaiting_approval'] }).default('pending').notNull(),
	agentConfigId: uuid('agent_config_id'),
	inputs: jsonb('inputs').default([]).notNull(),
	outputs: jsonb('outputs').default([]).notNull(),
	inputValues: jsonb('input_values').default({}).notNull(),
	outputValues: jsonb('output_values').default({}).notNull(),
	executionOrder: integer('execution_order').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_workflow_nodes_workflow').on(table.workflowId),
	index('idx_workflow_nodes_status').on(table.status),
])

export const workflowEdges = pgTable('workflow_edges', {
	id: uuid('id').defaultRandom().primaryKey(),
	workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
	sourceNodeId: uuid('source_node_id').notNull().references(() => workflowNodes.id, { onDelete: 'cascade' }),
	targetNodeId: uuid('target_node_id').notNull().references(() => workflowNodes.id, { onDelete: 'cascade' }),
	priority: integer('priority').default(0).notNull(),
}, (table) => [
	index('idx_workflow_edges_workflow').on(table.workflowId),
])
