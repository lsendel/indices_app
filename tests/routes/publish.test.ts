import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createPublishRoutes } from '../../src/routes/publish'

const mockPublishContent = vi.fn()
vi.mock('../../src/services/publishing/publisher', () => ({
	publishContent: (...args: any[]) => mockPublishContent(...args),
}))

const publishRow = {
	id: 'conn-1', tenantId: 't1', platform: 'instagram',
	accessToken: 'token', refreshToken: null, expiresAt: null,
	scopes: null, metadata: {},
}
const publishChain: any = { then: (resolve: any) => resolve([publishRow]) }
publishChain.where = vi.fn().mockReturnValue(publishChain)
publishChain.orderBy = vi.fn().mockReturnValue(publishChain)
publishChain.limit = vi.fn().mockReturnValue(publishChain)
publishChain.offset = vi.fn().mockReturnValue(publishChain)

const mockDb = {
	select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(publishChain) }),
	insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'pub-new' }]) }) }),
}

describe('publish routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		mockPublishContent.mockReset()
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); c.set('db', mockDb as any); await next() })
		app.route('/publish', createPublishRoutes())
	})

	it('POST / publishes to a single platform', async () => {
		mockPublishContent.mockResolvedValueOnce({
			platformContentId: 'media-123',
			url: 'https://instagram.com/p/abc',
			status: 'published',
		})

		const res = await app.request('/publish', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				platform: 'instagram',
				channel: 'instagram',
				content: { text: 'Hello' },
			}),
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.platformContentId).toBe('media-123')
	})

	it('POST /batch publishes to multiple platforms', async () => {
		mockPublishContent
			.mockResolvedValueOnce({ platformContentId: 'fb-1', url: 'https://fb.com/1', status: 'published' })
			.mockResolvedValueOnce({ platformContentId: 'li-1', url: 'https://linkedin.com/1', status: 'published' })

		const res = await app.request('/publish/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				platforms: ['facebook', 'linkedin'],
				channel: 'facebook',
				content: { text: 'Cross-post' },
			}),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.results).toHaveLength(2)
	})

	it('GET /history returns published content', async () => {
		const res = await app.request('/publish/history')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toBeDefined()
	})
})
