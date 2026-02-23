import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createMcpRoutes } from '../../src/routes/mcp'

vi.mock('../../src/adapters/openai', () => ({
	createOpenAIAdapter: vi.fn().mockReturnValue({
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn(),
	}),
}))

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([]),
					}),
				}),
			}),
		}),
	}),
}))

describe('MCP routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); c.set('userId', 'u1'); await next() })
		app.route('/mcp', createMcpRoutes())
	})

	it('GET /tools lists available MCP tools', async () => {
		const res = await app.request('/mcp/tools')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.tools).toHaveLength(11)
		expect(body.tools.map((t: { name: string }) => t.name)).toContain('get_sentiment_analysis')
	})

	it('POST /call invokes a tool by name', async () => {
		const res = await app.request('/mcp/call', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tool: 'score_lead', arguments: { company: 'TestCo', signals: ['demo_request'] } }),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.result).toBeDefined()
	})

	it('POST /call returns 404 for unknown tool', async () => {
		const res = await app.request('/mcp/call', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tool: 'nonexistent', arguments: {} }),
		})
		expect(res.status).toBe(404)
	})
})
