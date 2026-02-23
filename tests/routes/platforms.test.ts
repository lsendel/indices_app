import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createPlatformRoutes } from '../../src/routes/platforms'

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([{ id: 'conn-1', platform: 'instagram', metadata: {} }]) }) }) }),
		insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'conn-new', platform: 'wordpress' }]) }) }),
		delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'conn-1' }]) }) }),
	}),
}))

vi.mock('../../src/config', () => ({
	getConfig: vi.fn().mockReturnValue({
		META_APP_ID: 'meta-app-id',
		META_APP_SECRET: 'meta-secret',
		TIKTOK_CLIENT_KEY: 'tt-key',
		TIKTOK_CLIENT_SECRET: 'tt-secret',
		LINKEDIN_CLIENT_ID: 'li-id',
		LINKEDIN_CLIENT_SECRET: 'li-secret',
		BETTER_AUTH_URL: 'http://localhost:3001',
	}),
}))

describe('platform routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); await next() })
		app.route('/platforms', createPlatformRoutes())
	})

	it('GET / lists connected platforms', async () => {
		const res = await app.request('/platforms')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toBeDefined()
	})

	it('POST /wordpress/connect stores direct credentials', async () => {
		const res = await app.request('/platforms/wordpress/connect', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ siteUrl: 'https://myblog.com', username: 'admin', appPassword: 'pw123' }),
		})
		expect(res.status).toBe(201)
	})

	it('POST /blog/connect stores webhook config', async () => {
		const res = await app.request('/platforms/blog/connect', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ webhookUrl: 'https://hooks.example.com/publish' }),
		})
		expect(res.status).toBe(201)
	})

	it('DELETE /:platform disconnects', async () => {
		const res = await app.request('/platforms/instagram', { method: 'DELETE' })
		expect(res.status).toBe(200)
	})
})
