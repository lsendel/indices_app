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

	// List feed subscriptions
	router.get('/', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(feedSubscriptions)
			.where(eq(feedSubscriptions.tenantId, tenantId))
			.orderBy(desc(feedSubscriptions.createdAt))

		return c.json({ items })
	})

	// Create feed subscription
	router.post('/', validate('json', feedSubscriptionCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(feedSubscriptions).values({
			tenantId,
			name: data.name,
			feedUrl: data.feedUrl,
			feedType: data.feedType,
			schedule: data.schedule,
			keywords: data.keywords,
			maxItems: data.maxItems,
		}).returning()

		return c.json(created, 201)
	})

	// Update feed subscription
	router.patch('/:id', validate('json', feedSubscriptionUpdate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const data = c.req.valid('json')

		const [updated] = await db
			.update(feedSubscriptions)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(feedSubscriptions.id, id), eq(feedSubscriptions.tenantId, tenantId)))
			.returning()

		if (!updated) throw new NotFoundError('FeedSubscription', id)

		return c.json(updated)
	})

	// Delete feed subscription
	router.delete('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [deleted] = await db
			.delete(feedSubscriptions)
			.where(and(eq(feedSubscriptions.id, id), eq(feedSubscriptions.tenantId, tenantId)))
			.returning()

		if (!deleted) throw new NotFoundError('FeedSubscription', id)

		return c.json({ deleted: true, id: deleted.id })
	})

	return router
}
