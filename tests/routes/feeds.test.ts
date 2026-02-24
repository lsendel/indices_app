import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createFeedRoutes } from '../../src/routes/feeds'

const mockDb = {
	select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([{ id: 'feed-1', name: 'TechCrunch', active: true }]) }) }) }),
	insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'feed-new', name: 'HN' }]) }) }),
	update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'feed-1', active: false }]) }) }) }),
	delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'feed-1' }]) }) }),
}

describe('feed routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); c.set('db', mockDb as any); await next() })
		app.route('/feeds', createFeedRoutes())
	})

	it('GET / lists feeds', async () => {
		const res = await app.request('/feeds')
		expect(res.status).toBe(200)
	})

	it('POST / creates a feed', async () => {
		const res = await app.request('/feeds', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'HN', feedUrl: 'https://hn.algolia.com/feed' }),
		})
		expect(res.status).toBe(201)
	})

	it('PATCH /:id updates a feed', async () => {
		const res = await app.request('/feeds/feed-1', {
			method: 'PATCH', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ active: false }),
		})
		expect(res.status).toBe(200)
	})

	it('DELETE /:id deletes a feed', async () => {
		const res = await app.request('/feeds/feed-1', { method: 'DELETE' })
		expect(res.status).toBe(200)
	})
})
