import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createFeedRoutes } from '../../src/routes/feeds'

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([
						{
							id: 'feed-1',
							tenantId: 't1',
							name: 'TechCrunch',
							feedUrl: 'https://techcrunch.com/feed/',
							feedType: 'rss',
							active: true,
							schedule: '0 */6 * * *',
						},
					]),
				}),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{
					id: 'feed-new',
					tenantId: 't1',
					name: 'Hacker News',
					feedUrl: 'https://hn.algolia.com/api/v1/search',
					feedType: 'news',
					active: true,
				}]),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{
						id: 'feed-1',
						active: false,
					}]),
				}),
			}),
		}),
		delete: vi.fn().mockReturnValue({
			where: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 'feed-1' }]),
			}),
		}),
	}),
}))

describe('feed routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('tenantId', 't1')
			c.set('userId', 'u1')
			await next()
		})
		app.route('/feeds', createFeedRoutes())
	})

	it('GET / lists feed subscriptions', async () => {
		const res = await app.request('/feeds')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
		expect(body.items[0].name).toBe('TechCrunch')
	})

	it('POST / creates a feed subscription', async () => {
		const res = await app.request('/feeds', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Hacker News',
				feedUrl: 'https://hn.algolia.com/api/v1/search',
				feedType: 'news',
			}),
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.id).toBe('feed-new')
	})

	it('PATCH /:id updates a feed subscription', async () => {
		const res = await app.request('/feeds/feed-1', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ active: false }),
		})
		expect(res.status).toBe(200)
	})

	it('DELETE /:id deletes a feed subscription', async () => {
		const res = await app.request('/feeds/feed-1', {
			method: 'DELETE',
		})
		expect(res.status).toBe(200)
	})

	it('POST / rejects invalid feedUrl', async () => {
		const res = await app.request('/feeds', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Test', feedUrl: 'not-a-url' }),
		})
		expect(res.status).toBe(422)
	})
})
