import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { engagementEvents } from '../db/schema'
import { getDb } from '../db/client'

export function createEngagementRoutes() {
	const router = new Hono<AppEnv>()

	// Aggregate summary (must be before /:publishedContentId)
	router.get('/summary', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const summary = await db
			.select()
			.from(engagementEvents)
			.where(eq(engagementEvents.tenantId, tenantId))
			.orderBy(desc(engagementEvents.recordedAt))
			.limit(1000)

		return c.json({ summary })
	})

	// Top performing content (must be before /:publishedContentId)
	router.get('/leaderboard', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const leaderboard = await db
			.select()
			.from(engagementEvents)
			.where(eq(engagementEvents.tenantId, tenantId))
			.orderBy(desc(engagementEvents.recordedAt))
			.limit(50)

		return c.json({ leaderboard })
	})

	// Metrics for specific published content
	router.get('/:publishedContentId', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const publishedContentId = c.req.param('publishedContentId')

		const events = await db
			.select()
			.from(engagementEvents)
			.where(
				and(
					eq(engagementEvents.tenantId, tenantId),
					eq(engagementEvents.publishedContentId, publishedContentId),
				),
			)
			.orderBy(desc(engagementEvents.recordedAt))

		return c.json({ events })
	})

	return router
}
