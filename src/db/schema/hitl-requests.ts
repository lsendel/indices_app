import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { workflows, workflowNodes } from './workflows'

export const hitlRequests = pgTable('hitl_requests', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
	nodeId: uuid('node_id').notNull().references(() => workflowNodes.id, { onDelete: 'cascade' }),
	decision: text('decision', { enum: ['pending', 'approved', 'rejected', 'modified'] }).default('pending').notNull(),
	context: jsonb('context').default({}).notNull(),
	modifications: jsonb('modifications'),
	decidedBy: uuid('decided_by'),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	decidedAt: timestamp('decided_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_hitl_requests_tenant').on(table.tenantId),
	index('idx_hitl_requests_workflow').on(table.workflowId),
	index('idx_hitl_requests_decision').on(table.decision),
])
