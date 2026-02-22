import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { workflows, workflowNodes, workflowEdges } from '../db/schema'
import { getDb } from '../db/client'
import { workflowCreate } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createWorkflowRoutes() {
	const router = new Hono<AppEnv>()

	// List workflows
	router.get('/', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(workflows)
			.where(eq(workflows.tenantId, tenantId))
			.orderBy(desc(workflows.createdAt))

		return c.json({ items })
	})

	// Create workflow
	router.post('/', validate('json', workflowCreate), async (c) => {
		const db = getDb()
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
		const db = getDb()
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
			.where(eq(workflowNodes.workflowId, id))

		const edges = await db
			.select()
			.from(workflowEdges)
			.where(eq(workflowEdges.workflowId, id))

		return c.json({ ...workflow, nodes, edges })
	})

	return router
}
