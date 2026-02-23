import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createEngagementRoutes } from '../../src/routes/engagement'

vi.mock('../../src/db/client', () => {
	const chain: any = { then: (resolve: any) => resolve([{ eventType: 'like', count: 5 }]) }
	chain.where = vi.fn().mockReturnValue(chain)
	chain.orderBy = vi.fn().mockReturnValue(chain)
	chain.groupBy = vi.fn().mockReturnValue(chain)
	chain.limit = vi.fn().mockReturnValue(chain)
	chain.offset = vi.fn().mockReturnValue(chain)

	return {
		getDb: vi.fn().mockReturnValue({
			select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(chain) }),
		}),
	}
})

describe('engagement routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); await next() })
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
