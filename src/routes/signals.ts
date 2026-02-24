import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { eq, and, desc, gte } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { signals, accountScores } from '../db/schema'
import { signalCapture } from '../types/api'

export function createSignalRoutes() {
	const router = new Hono<AppEnv>()

	// Capture a signal
	router.post('/capture', validate('json', signalCapture), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(signals).values({ ...data, tenantId }).returning()
		return c.json(created, 201)
	})

	// Get hot accounts (score above threshold)
	router.get('/hot', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const threshold = Number(c.req.query('threshold') ?? 50)
		const limit = Number(c.req.query('limit') ?? 50)

		const hot = await db
			.select()
			.from(accountScores)
			.where(and(eq(accountScores.tenantId, tenantId), gte(accountScores.totalScore, threshold)))
			.orderBy(desc(accountScores.totalScore))
			.limit(limit)

		return c.json({ items: hot, threshold, count: hot.length })
	})

	// Get signals for an account
	router.get('/accounts/:accountId', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const accountId = c.req.param('accountId')
		const days = Number(c.req.query('days') ?? 90)

		const since = new Date()
		since.setDate(since.getDate() - days)

		const items = await db
			.select()
			.from(signals)
			.where(and(
				eq(signals.tenantId, tenantId),
				eq(signals.accountId, accountId),
				gte(signals.createdAt, since),
			))
			.orderBy(desc(signals.createdAt))

		return c.json({ items, accountId, days })
	})

	return router
}
