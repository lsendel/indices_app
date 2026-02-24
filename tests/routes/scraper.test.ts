import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createScraperRoutes } from '../../src/routes/scraper'

vi.mock('../../src/services/scraper/job-tracker', () => ({
	createJob: vi.fn().mockResolvedValue({ id: 'job-new', tenantId: 't1', jobType: 'web_crawl', status: 'pending' }),
	getJobStatus: vi.fn().mockResolvedValue({ id: 'job-1', status: 'running', pagesScraped: 42 }),
	cancelJob: vi.fn().mockResolvedValue({ id: 'job-1', status: 'cancelled' }),
	failJob: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../src/services/scraper/dispatcher', () => ({
	dispatchScrapeJob: vi.fn().mockResolvedValue({ status: 'queued' }),
	signPayload: vi.fn(), verifySignature: vi.fn(),
}))

const mockDb = {
	select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }) }) }),
}

describe('scraper routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			if (!c.env) (c as any).env = {}
			c.set('tenantId', 't1')
			c.set('userId', 'u1')
			c.set('db', mockDb as any)
			await next()
		})
		app.route('/scraper', createScraperRoutes())
	})

	it('POST /jobs dispatches a scrape job', async () => {
		const res = await app.request('/scraper/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jobType: 'web_crawl', seedUrls: ['https://example.com'] }),
		})
		expect(res.status).toBe(201)
	})

	it('GET /jobs/:id returns job status', async () => {
		const res = await app.request('/scraper/jobs/job-1')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.status).toBe('running')
	})

	it('POST /jobs/:id/cancel cancels a job', async () => {
		const res = await app.request('/scraper/jobs/job-1/cancel', { method: 'POST' })
		expect(res.status).toBe(200)
	})

	it('rejects invalid jobType', async () => {
		const res = await app.request('/scraper/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jobType: 'invalid' }),
		})
		expect(res.status).toBe(422)
	})
})
