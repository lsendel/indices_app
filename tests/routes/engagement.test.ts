import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createEngagementRoutes } from '../../src/routes/engagement'

const engagementChain: any = { then: (resolve: any) => resolve([{ eventType: 'like', count: 5 }]) }
engagementChain.where = vi.fn().mockReturnValue(engagementChain)
engagementChain.orderBy = vi.fn().mockReturnValue(engagementChain)
engagementChain.groupBy = vi.fn().mockReturnValue(engagementChain)
engagementChain.limit = vi.fn().mockReturnValue(engagementChain)
engagementChain.offset = vi.fn().mockReturnValue(engagementChain)

const mockDb = {
	select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(engagementChain) }),
}

describe('engagement routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); c.set('db', mockDb as any); await next() })
		app.route('/engagement', createEngagementRoutes())
	})

	it('GET /:publishedContentId returns metrics', async () => {
		const res = await app.request('/engagement/pub-123')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.events).toBeDefined()
	})

	it('GET /summary returns aggregate data', async () => {
		const res = await app.request('/engagement/summary')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.summary).toBeDefined()
	})

	it('GET /leaderboard returns top content', async () => {
		const res = await app.request('/engagement/leaderboard')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.leaderboard).toBeDefined()
	})
})
