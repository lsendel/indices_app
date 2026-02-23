import { Hono } from 'hono'
import { eq, and, desc, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { evolutionCycles, hitlRequests } from '../db/schema'
import { getDb } from '../db/client'
import { evolutionStart, hitlDecision, paginationQuery } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createEvolutionRoutes() {
	const router = new Hono<AppEnv>()

	// List evolution cycles
	router.get('/cycles', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit

		const [items, countResult] = await Promise.all([
			db.select().from(evolutionCycles).where(eq(evolutionCycles.tenantId, tenantId)).orderBy(desc(evolutionCycles.createdAt)).limit(limit).offset(offset),
			db.select({ count: sql<number>`count(*)` }).from(evolutionCycles).where(eq(evolutionCycles.tenantId, tenantId)),
		])

		return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
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
			populationSize: data.populationSize,
			generations: data.generations,
		}).returning()

		return c.json(created, 201)
	})

	// List pending HITL requests
	router.get('/hitl', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit
		const condition = and(eq(hitlRequests.tenantId, tenantId), eq(hitlRequests.decision, 'pending'))

		const [items, countResult] = await Promise.all([
			db.select().from(hitlRequests).where(condition).orderBy(desc(hitlRequests.createdAt)).limit(limit).offset(offset),
			db.select({ count: sql<number>`count(*)` }).from(hitlRequests).where(condition),
		])

		return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
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
