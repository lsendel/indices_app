import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createEvolutionRoutes } from '../../src/routes/evolution'

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([
						{ id: 'ec-1', tenantId: 't1', generation: 1, strategy: 'hybrid', status: 'completed' },
					]),
				}),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{
					id: 'ec-new',
					tenantId: 't1',
					generation: 1,
					strategy: 'ga',
					status: 'pending',
				}]),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{
						id: 'hitl-1',
						decision: 'approved',
						decidedBy: 'u1',
					}]),
				}),
			}),
		}),
	}),
}))

describe('evolution routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('tenantId', 't1')
			c.set('userId', 'u1')
			await next()
		})
		app.route('/evolution', createEvolutionRoutes())
	})

	it('GET /cycles lists evolution cycles', async () => {
		const res = await app.request('/evolution/cycles')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
	})

	it('POST /cycles starts a new evolution cycle', async () => {
		const res = await app.request('/evolution/cycles', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agentConfigId: '550e8400-e29b-41d4-a716-446655440000',
				strategy: 'ga',
			}),
		})
		expect(res.status).toBe(201)
	})

	it('POST /hitl/:id/decide resolves a HITL request', async () => {
		const res = await app.request('/evolution/hitl/hitl-1/decide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ decision: 'approved' }),
		})
		expect(res.status).toBe(200)
	})

	it('POST /hitl/:id/decide rejects invalid decision', async () => {
		const res = await app.request('/evolution/hitl/hitl-1/decide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ decision: 'maybe' }),
		})
		expect(res.status).toBe(422)
	})
})
