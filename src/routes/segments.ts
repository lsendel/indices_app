import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { and, eq, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { segments } from '../db/schema'
import { getDb } from '../db/client'
import { segmentCreate, paginationQuery } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createSegmentRoutes() {
	const router = new Hono<AppEnv>()

	// List segments
	router.get('/', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit

		const [items, countResult] = await Promise.all([
			db.select().from(segments).where(eq(segments.tenantId, tenantId)).limit(limit).offset(offset).orderBy(segments.createdAt),
			db.select({ count: sql<number>`count(*)` }).from(segments).where(eq(segments.tenantId, tenantId)),
		])

		return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
	})

	// Get segment by ID
	router.get('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const [segment] = await db.select().from(segments).where(and(eq(segments.id, id), eq(segments.tenantId, tenantId)))
		if (!segment) throw new NotFoundError('Segment', id)
		return c.json(segment)
	})

	// Create segment
	router.post('/', validate('json', segmentCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const [created] = await db.insert(segments).values({ ...data, tenantId }).returning()
		return c.json(created, 201)
	})

	// Update segment
	router.patch('/:id', validate('json', segmentCreate.partial()), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const data = c.req.valid('json')

		const [updated] = await db
			.update(segments)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(segments.id, id), eq(segments.tenantId, tenantId)))
			.returning()
		if (!updated) throw new NotFoundError('Segment', id)
		return c.json(updated)
	})

	// Delete segment
	router.delete('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const [deleted] = await db.delete(segments).where(and(eq(segments.id, id), eq(segments.tenantId, tenantId))).returning()
		if (!deleted) throw new NotFoundError('Segment', id)
		return c.json({ deleted: true })
	})

	return router
}
