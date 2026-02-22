import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createWorkflowRoutes } from '../../src/routes/workflows'

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([
						{
							id: 'wf-1',
							tenantId: 't1',
							goal: 'Launch campaign',
							status: 'pending',
							createdAt: new Date(),
							updatedAt: new Date(),
						},
					]),
				}),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{
					id: 'wf-new',
					tenantId: 't1',
					goal: 'New campaign',
					status: 'pending',
					createdAt: new Date(),
					updatedAt: new Date(),
				}]),
			}),
		}),
	}),
}))

describe('workflow routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('tenantId', 't1')
			c.set('userId', 'u1')
			await next()
		})
		app.route('/workflows', createWorkflowRoutes())
	})

	it('GET / lists workflows', async () => {
		const res = await app.request('/workflows')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
		expect(body.items[0].goal).toBe('Launch campaign')
	})

	it('POST / creates a workflow', async () => {
		const res = await app.request('/workflows', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ goal: 'New campaign' }),
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.id).toBe('wf-new')
	})

	it('POST / rejects empty goal', async () => {
		const res = await app.request('/workflows', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ goal: '' }),
		})
		expect(res.status).toBe(422)
	})
})
