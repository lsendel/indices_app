import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { authMiddleware } from '../../src/middleware/auth'
import { errorHandler } from '../../src/middleware/error-handler'

describe('tenant resolution in auth middleware', () => {
	it('sets tenantId in dev mode', async () => {
		const app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			if (!c.env) (c as any).env = { ENVIRONMENT: 'development' }
			// Mock db
			c.set('db', {
				select: () => ({
					from: () => ({
						limit: () => Promise.resolve([{ id: 'test-tenant-id' }]),
					}),
				}),
			} as any)
			await next()
		})
		app.use('/api/*', authMiddleware())
		app.get('/api/test', (c) => c.json({
			userId: c.get('userId'),
			tenantId: c.get('tenantId'),
		}))

		const res = await app.request('/api/test')
		expect(res.status).toBe(200)
		const body = await res.json() as any
		expect(body.userId).toBe('dev_user')
		expect(body.tenantId).toBeDefined()
	})

	it('rejects requests without session in production', async () => {
		const app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			if (!c.env) (c as any).env = { ENVIRONMENT: 'production' }
			await next()
		})
		app.onError(errorHandler)
		app.use('/api/*', authMiddleware())
		app.get('/api/test', (c) => c.json({ ok: true }))

		const res = await app.request('/api/test')
		expect(res.status).toBe(401)
	})
})
