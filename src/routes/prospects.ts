import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { and, eq, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { prospects } from '../db/schema'
import { getDb } from '../db/client'
import { prospectCreate, prospectUpdate, paginationQuery } from '../types/api'
import { NotFoundError, ConflictError } from '../types/errors'

export function createProspectRoutes() {
	const router = new Hono<AppEnv>()

	// List prospects
	router.get('/', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit

		const [items, countResult] = await Promise.all([
			db.select().from(prospects).where(eq(prospects.tenantId, tenantId)).limit(limit).offset(offset).orderBy(prospects.createdAt),
			db.select({ count: sql<number>`count(*)` }).from(prospects).where(eq(prospects.tenantId, tenantId)),
		])

		return c.json({
			items,
			total: countResult[0]?.count ?? 0,
			page,
			limit,
		})
	})

	// Get prospect by ID
	router.get('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const [prospect] = await db.select().from(prospects).where(and(eq(prospects.id, id), eq(prospects.tenantId, tenantId)))
		if (!prospect) throw new NotFoundError('Prospect', id)
		return c.json(prospect)
	})

	// Create prospect
	router.post('/', validate('json', prospectCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		if (data.email) {
			const [existing] = await db.select().from(prospects).where(and(eq(prospects.email, data.email), eq(prospects.tenantId, tenantId)))
			if (existing) throw new ConflictError(`Prospect with email ${data.email} already exists`)
		}

		const [created] = await db.insert(prospects).values({ ...data, tenantId }).returning()
		return c.json(created, 201)
	})

	// Update prospect
	router.patch('/:id', validate('json', prospectUpdate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const data = c.req.valid('json')

		const [updated] = await db
			.update(prospects)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(prospects.id, id), eq(prospects.tenantId, tenantId)))
			.returning()
		if (!updated) throw new NotFoundError('Prospect', id)
		return c.json(updated)
	})

	// Delete prospect
	router.delete('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const [deleted] = await db.delete(prospects).where(and(eq(prospects.id, id), eq(prospects.tenantId, tenantId))).returning()
		if (!deleted) throw new NotFoundError('Prospect', id)
		return c.json({ deleted: true })
	})

	return router
}
