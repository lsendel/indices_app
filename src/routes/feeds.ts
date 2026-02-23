import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { feedSubscriptions } from '../db/schema'
import { getDb } from '../db/client'
import { feedSubscriptionCreate, feedSubscriptionUpdate } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createFeedRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const items = await db.select().from(feedSubscriptions).where(eq(feedSubscriptions.tenantId, tenantId)).orderBy(desc(feedSubscriptions.createdAt))
		return c.json({ items })
	})

	router.post('/', validate('json', feedSubscriptionCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const [created] = await db.insert(feedSubscriptions).values({ tenantId, ...data }).returning()
		return c.json(created, 201)
	})

	router.patch('/:id', validate('json', feedSubscriptionUpdate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const data = c.req.valid('json')
		const [updated] = await db.update(feedSubscriptions).set({ ...data, updatedAt: new Date() }).where(and(eq(feedSubscriptions.id, id), eq(feedSubscriptions.tenantId, tenantId))).returning()
		if (!updated) throw new NotFoundError('FeedSubscription', id)
		return c.json(updated)
	})

	router.delete('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const [deleted] = await db.delete(feedSubscriptions).where(and(eq(feedSubscriptions.id, id), eq(feedSubscriptions.tenantId, tenantId))).returning()
		if (!deleted) throw new NotFoundError('FeedSubscription', id)
		return c.json({ deleted: true, id: deleted.id })
	})

	return router
}
