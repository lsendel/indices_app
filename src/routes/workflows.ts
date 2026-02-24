import { Hono } from 'hono'
import { eq, and, desc, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { workflows, workflowNodes, workflowEdges } from '../db/schema'
import { workflowCreate, paginationQuery } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createWorkflowRoutes() {
	const router = new Hono<AppEnv>()

	// List workflows
	router.get('/', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit

		const [items, countResult] = await Promise.all([
			db.select().from(workflows).where(eq(workflows.tenantId, tenantId)).orderBy(desc(workflows.createdAt)).limit(limit).offset(offset),
			db.select({ count: sql<number>`count(*)` }).from(workflows).where(eq(workflows.tenantId, tenantId)),
		])

		return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
	})

	// Create workflow
	router.post('/', validate('json', workflowCreate), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(workflows).values({
			tenantId,
			goal: data.goal,
			campaignId: data.campaignId,
			metadata: data.metadata ?? {},
		}).returning()

		return c.json(created, 201)
	})

	// Get workflow with nodes and edges
	router.get('/:id', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [workflow] = await db
			.select()
			.from(workflows)
			.where(and(eq(workflows.id, id), eq(workflows.tenantId, tenantId)))
		if (!workflow) throw new NotFoundError('Workflow', id)

		const nodes = await db
			.select()
			.from(workflowNodes)
			.where(eq(workflowNodes.workflowId, workflow.id))

		const edges = await db
			.select()
			.from(workflowEdges)
			.where(eq(workflowEdges.workflowId, workflow.id))

		return c.json({ ...workflow, nodes, edges })
	})

	return router
}
