import { Hono } from 'hono'
import { eq, and, desc, gte, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { sentimentArticles, driftEvents } from '../db/schema'

export function createSentimentRoutes() {
	const router = new Hono<AppEnv>()

	// Get sentiment signals for a brand
	router.get('/signals', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const brand = c.req.query('brand') ?? c.req.query('ticker') ?? ''
		const window = c.req.query('window') ?? '24h'
		const limit = Number(c.req.query('limit') ?? 50)

		const hours = window === '7d' ? 168 : window === '24h' ? 24 : window === '1h' ? 1 : 24
		const since = new Date()
		since.setHours(since.getHours() - hours)

		const items = await db
			.select()
			.from(sentimentArticles)
			.where(and(
				eq(sentimentArticles.tenantId, tenantId),
				eq(sentimentArticles.brand, brand),
				gte(sentimentArticles.analyzedAt, since),
			))
			.orderBy(desc(sentimentArticles.analyzedAt))
			.limit(limit)

		return c.json({ items, brand, window, count: items.length })
	})

	// Get drift events for a brand
	router.get('/drift', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const brand = c.req.query('brand') ?? ''
		const limit = Number(c.req.query('limit') ?? 20)

		const items = await db
			.select()
			.from(driftEvents)
			.where(and(eq(driftEvents.tenantId, tenantId), eq(driftEvents.brand, brand)))
			.orderBy(desc(driftEvents.createdAt))
			.limit(limit)

		return c.json({ items, brand })
	})

	// Get competitive summary
	router.get('/competitive', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const window = c.req.query('window') ?? '7d'

		const hours = window === '30d' ? 720 : window === '7d' ? 168 : 24
		const since = new Date()
		since.setHours(since.getHours() - hours)

		const items = await db
			.select({
				brand: sentimentArticles.brand,
				avgScore: sql<number>`avg(${sentimentArticles.sentimentScore})`,
				count: sql<number>`count(*)`,
			})
			.from(sentimentArticles)
			.where(and(eq(sentimentArticles.tenantId, tenantId), gte(sentimentArticles.analyzedAt, since)))
			.groupBy(sentimentArticles.brand)

		return c.json({ items, window })
	})

	return router
}
