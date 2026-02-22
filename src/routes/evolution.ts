import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { evolutionCycles, hitlRequests } from '../db/schema'
import { getDb } from '../db/client'
import { evolutionStart, hitlDecision } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createEvolutionRoutes() {
	const router = new Hono<AppEnv>()

	// List evolution cycles
	router.get('/cycles', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(evolutionCycles)
			.where(eq(evolutionCycles.tenantId, tenantId))
			.orderBy(desc(evolutionCycles.createdAt))

		return c.json({ items })
	})

	// Start evolution cycle
	router.post('/cycles', validate('json', evolutionStart), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(evolutionCycles).values({
			tenantId,
			agentConfigId: data.agentConfigId,
			generation: 1,
			strategy: data.strategy,
		}).returning()

		return c.json(created, 201)
	})

	// List pending HITL requests
	router.get('/hitl', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(hitlRequests)
			.where(and(eq(hitlRequests.tenantId, tenantId), eq(hitlRequests.decision, 'pending')))
			.orderBy(desc(hitlRequests.createdAt))

		return c.json({ items })
	})

	// Decide on a HITL request
	router.post('/hitl/:id/decide', validate('json', hitlDecision), async (c) => {
		const db = getDb()
		const id = c.req.param('id')
		const tenantId = c.get('tenantId')!
		const userId = c.get('userId')!
		const data = c.req.valid('json')

		const [updated] = await db
			.update(hitlRequests)
			.set({
				decision: data.decision,
				decidedBy: userId,
				modifications: data.modifications,
				decidedAt: new Date(),
			})
			.where(and(eq(hitlRequests.id, id), eq(hitlRequests.tenantId, tenantId), eq(hitlRequests.decision, 'pending')))
			.returning()

		if (!updated) throw new NotFoundError('HITL request', id)

		return c.json(updated)
	})

	return router
}
