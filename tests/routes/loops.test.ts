import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createLoopRoutes } from '../../src/routes/loops'

const loopChain: any = { then: (resolve: any) => resolve([]) }
loopChain.where = vi.fn().mockReturnValue(loopChain)
loopChain.orderBy = vi.fn().mockReturnValue(loopChain)
loopChain.limit = vi.fn().mockReturnValue(loopChain)
loopChain.offset = vi.fn().mockReturnValue(loopChain)

const mockDb = {
	select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue(loopChain) }),
}

describe('loop routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('tenantId', 't1')
			c.set('db', mockDb as any)
			await next()
		})
		app.route('/loops', createLoopRoutes())
	})

	it('GET /pipelines should return pipelines from DB', async () => {
		const res = await app.request('/loops/pipelines')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.pipelines).toBeInstanceOf(Array)
	})

	it('GET /rules should return rules from DB', async () => {
		const res = await app.request('/loops/rules')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.rules).toBeInstanceOf(Array)
	})

	it('GET /groups should return channel groups', async () => {
		const res = await app.request('/loops/groups')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.groups).toBeInstanceOf(Array)
		expect(body.groups.length).toBeGreaterThan(0)
	})

	it('GET /events should return events with pagination', async () => {
		const res = await app.request('/loops/events?limit=10&offset=0')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.events).toBeInstanceOf(Array)
	})

	it('GET /lineage/:channel should return prompt versions', async () => {
		const res = await app.request('/loops/lineage/email')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.versions).toBeInstanceOf(Array)
	})
})
