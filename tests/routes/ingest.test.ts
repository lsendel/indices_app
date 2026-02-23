import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createIngestRoutes } from '../../src/routes/ingest'

vi.mock('../../src/services/scraper/batch-handler', () => ({
	processBatch: vi.fn().mockResolvedValue({
		jobId: 'job-1',
		batchIndex: 0,
		processed: 3,
		deduplicated: 1,
		isFinal: false,
	}),
}))

vi.mock('../../src/services/scraper/dispatcher', () => ({
	verifySignature: vi.fn().mockReturnValue(true),
}))

describe('ingest routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.route('/ingest', createIngestRoutes())
	})

	it('POST /batch persists content and returns result', async () => {
		const batch = {
			job_id: 'job-1',
			batch_index: 0,
			is_final: false,
			tenant_id: 'tenant-1',
			pages: [
				{ url: 'https://example.com', title: 'Test', content: 'Content' },
			],
		}
		const body = JSON.stringify(batch)
		const timestamp = Math.floor(Date.now() / 1000).toString()

		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-signature': 'valid-sig',
				'x-timestamp': timestamp,
			},
			body,
		})
		expect(res.status).toBe(200)
		const result = await res.json()
		expect(result.processed).toBe(3)
		expect(result.deduplicated).toBe(1)
	})

	it('rejects requests without HMAC headers', async () => {
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ job_id: '1', batch_index: 0, is_final: true }),
		})
		expect(res.status).toBe(401)
	})

	it('rejects expired timestamps', async () => {
		const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString()
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-signature': 'sig',
				'x-timestamp': oldTimestamp,
			},
			body: JSON.stringify({ job_id: '1', batch_index: 0, is_final: true }),
		})
		expect(res.status).toBe(401)
	})
})
