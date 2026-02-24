import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createAnalyticsRoutes } from '../../src/routes/analytics'

const mockDb = {
	select: vi.fn().mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([{ count: 0 }]),
		}),
	}),
}

describe('analytics routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); c.set('db', mockDb as any); await next() })
		app.route('/analytics', createAnalyticsRoutes())
	})

	it('GET /dashboard returns summary metrics', async () => {
		const res = await app.request('/analytics/dashboard')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.prospects).toBeDefined()
		expect(body.campaigns).toBeDefined()
		expect(body.experiments).toBeDefined()
		expect(body.workflows).toBeDefined()
		expect(body.publishedContent).toBeDefined()
		expect(body.publishedContent.total).toBe(0)
	})
})
