import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createSseRoutes, emitEvent } from '../../src/routes/sse'

describe('SSE routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); await next() })
		app.route('/sse', createSseRoutes())
	})

	it('GET /stream returns SSE content type', async () => {
		const controller = new AbortController()
		const res = await app.request('/sse/stream', { signal: controller.signal })
		expect(res.headers.get('content-type')).toContain('text/event-stream')
		controller.abort()
	})

	it('emitEvent formats SSE event correctly', () => {
		const event = emitEvent('sentiment_update', { brand: 'Acme', score: 0.8 })
		expect(event).toContain('event: sentiment_update')
		expect(event).toContain('data: ')
		expect(event).toContain('"brand":"Acme"')
	})

	it('emitEvent includes event id', () => {
		const event = emitEvent('signal_alert', { accountId: 'a1' }, 'evt-123')
		expect(event).toContain('id: evt-123')
	})
})
