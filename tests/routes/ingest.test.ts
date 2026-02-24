import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createIngestRoutes } from '../../src/routes/ingest'

vi.mock('../../src/services/scraper/batch-handler', () => ({
	processBatch: vi.fn().mockResolvedValue({
		jobId: 'job-1', batchIndex: 0, processed: 3, deduplicated: 1, isFinal: false,
	}),
}))

vi.mock('../../src/services/scraper/dispatcher', () => ({
	verifySignature: vi.fn().mockReturnValue(true),
}))

describe('ingest routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			if (!c.env) (c as any).env = {}
			await next()
		})
		app.route('/ingest', createIngestRoutes())
	})

	it('POST /batch persists content and returns result', async () => {
		const timestamp = Math.floor(Date.now() / 1000).toString()
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-signature': 'sig', 'x-timestamp': timestamp },
			body: JSON.stringify({ job_id: 'job-1', batch_index: 0, is_final: false, tenant_id: 't1', pages: [] }),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.processed).toBe(3)
	})

	it('rejects requests without HMAC headers', async () => {
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ job_id: '1', batch_index: 0, is_final: true }),
		})
		expect(res.status).toBe(401)
	})

	it('rejects invalid JSON body', async () => {
		const timestamp = Math.floor(Date.now() / 1000).toString()
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-signature': 'sig', 'x-timestamp': timestamp },
			body: 'not json',
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toBe('Invalid JSON body')
	})

	it('rejects payload missing tenant_id', async () => {
		const timestamp = Math.floor(Date.now() / 1000).toString()
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-signature': 'sig', 'x-timestamp': timestamp },
			body: JSON.stringify({ job_id: 'job-1', batch_index: 0, is_final: false }),
		})
		expect(res.status).toBe(400)
		const body = await res.json()
		expect(body.error).toBe('Missing tenant_id in payload')
	})

	it('rejects non-numeric timestamp', async () => {
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-signature': 'sig', 'x-timestamp': 'abc' },
			body: JSON.stringify({ job_id: '1', batch_index: 0, is_final: true }),
		})
		expect(res.status).toBe(401)
		const body = await res.json()
		expect(body.error).toBe('Invalid timestamp')
	})

	it('rejects stale timestamps', async () => {
		const staleTimestamp = (Math.floor(Date.now() / 1000) - 600).toString()
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-signature': 'sig', 'x-timestamp': staleTimestamp },
			body: JSON.stringify({ job_id: '1', batch_index: 0, is_final: true }),
		})
		expect(res.status).toBe(401)
		const body = await res.json()
		expect(body.error).toBe('Timestamp too old')
	})

	it('rejects invalid signatures', async () => {
		const { verifySignature } = await import('../../src/services/scraper/dispatcher')
		vi.mocked(verifySignature).mockReturnValueOnce(false)

		const timestamp = Math.floor(Date.now() / 1000).toString()
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-signature': 'bad-sig', 'x-timestamp': timestamp },
			body: JSON.stringify({ job_id: '1', batch_index: 0, is_final: true, tenant_id: 't1' }),
		})
		expect(res.status).toBe(401)
		const body = await res.json()
		expect(body.error).toBe('Invalid signature')
	})
})
