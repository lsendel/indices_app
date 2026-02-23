import { describe, it, expect, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createLoopRoutes } from '../../src/routes/loops'

describe('loop routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); await next() })
		app.route('/loops', createLoopRoutes())
	})

	it('GET /pipelines should return stub pipelines', async () => {
		const res = await app.request('/loops/pipelines')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.pipelines).toBeInstanceOf(Array)
		expect(body.status).toBe('stub')
	})

	it('GET /rules should return stub rules', async () => {
		const res = await app.request('/loops/rules')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.rules).toBeInstanceOf(Array)
		expect(body.status).toBe('stub')
	})

	it('GET /groups should return channel groups (live)', async () => {
		const res = await app.request('/loops/groups')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.groups).toBeInstanceOf(Array)
		expect(body.status).toBeUndefined()
	})

	it('GET /events should return stub event history', async () => {
		const res = await app.request('/loops/events')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.events).toBeInstanceOf(Array)
		expect(body.status).toBe('stub')
	})

	it('GET /lineage/:channel should return stub prompt lineage', async () => {
		const res = await app.request('/loops/lineage/email')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.versions).toBeInstanceOf(Array)
		expect(body.status).toBe('stub')
	})
})
