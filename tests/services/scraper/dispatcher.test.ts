import { describe, it, expect, vi, beforeEach } from 'vitest'
import { signPayload, verifySignature, dispatchScrapeJob } from '../../../src/services/scraper/dispatcher'

const dispatchOpts = { scraperWorkerUrl: 'http://localhost:8080', scraperSharedSecret: 'test-secret' }

describe('signPayload', () => {
	it('produces a deterministic HMAC-SHA256 hex string', () => {
		const sig1 = signPayload('body', '12345', 'secret')
		const sig2 = signPayload('body', '12345', 'secret')
		expect(sig1).toBe(sig2)
		expect(sig1).toMatch(/^[a-f0-9]{64}$/)
	})

	it('produces different signatures for different inputs', () => {
		const base = signPayload('body', '12345', 'secret')
		expect(signPayload('body2', '12345', 'secret')).not.toBe(base)
		expect(signPayload('body', '12346', 'secret')).not.toBe(base)
		expect(signPayload('body', '12345', 'secret2')).not.toBe(base)
	})
})

describe('verifySignature', () => {
	it('returns true for a valid signature', () => {
		const sig = signPayload('hello', '1000', 'key')
		expect(verifySignature('hello', '1000', sig, 'key')).toBe(true)
	})

	it('returns false for a tampered body', () => {
		const sig = signPayload('hello', '1000', 'key')
		expect(verifySignature('tampered', '1000', sig, 'key')).toBe(false)
	})

	it('returns false for a tampered timestamp', () => {
		const sig = signPayload('hello', '1000', 'key')
		expect(verifySignature('hello', '9999', sig, 'key')).toBe(false)
	})

	it('returns false for a wrong secret', () => {
		const sig = signPayload('hello', '1000', 'key')
		expect(verifySignature('hello', '1000', sig, 'wrong')).toBe(false)
	})

	it('returns false for mismatched-length signature (triggers catch branch)', () => {
		expect(verifySignature('hello', '1000', 'short', 'key')).toBe(false)
	})
})

describe('dispatchScrapeJob', () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it('dispatches web_crawl to /api/v1/jobs', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ status: 'queued' }),
		})
		vi.stubGlobal('fetch', mockFetch)

		await dispatchScrapeJob({
			jobId: 'j1',
			callbackUrl: 'http://localhost/webhooks/ingest/batch',
			config: { jobType: 'web_crawl', seedUrls: ['https://example.com'], maxPages: 10 },
		}, dispatchOpts)

		expect(mockFetch).toHaveBeenCalledWith(
			'http://localhost:8080/api/v1/jobs',
			expect.objectContaining({ method: 'POST' }),
		)
	})

	it('dispatches social_scrape to /api/v1/social/scrape', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ status: 'queued' }),
		})
		vi.stubGlobal('fetch', mockFetch)

		await dispatchScrapeJob({
			jobId: 'j2',
			callbackUrl: 'http://localhost/webhooks/ingest/batch',
			config: { jobType: 'social_scrape', subreddits: ['rust'], maxPages: 50 },
		}, dispatchOpts)

		expect(mockFetch).toHaveBeenCalledWith(
			'http://localhost:8080/api/v1/social/scrape',
			expect.objectContaining({ method: 'POST' }),
		)
	})

	it('dispatches feed_ingest to /api/v1/feeds/ingest', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({ status: 'queued' }),
		})
		vi.stubGlobal('fetch', mockFetch)

		await dispatchScrapeJob({
			jobId: 'j3',
			callbackUrl: 'http://localhost/webhooks/ingest/batch',
			config: { jobType: 'feed_ingest', feedSubscriptionId: '00000000-0000-0000-0000-000000000001', maxPages: 100 },
		}, dispatchOpts)

		expect(mockFetch).toHaveBeenCalledWith(
			'http://localhost:8080/api/v1/feeds/ingest',
			expect.objectContaining({ method: 'POST' }),
		)
	})

	it('sends correct HMAC headers', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve({}),
		})
		vi.stubGlobal('fetch', mockFetch)

		await dispatchScrapeJob({
			jobId: 'j1',
			callbackUrl: 'http://localhost/webhooks/ingest/batch',
			config: { jobType: 'web_crawl', seedUrls: ['https://example.com'], maxPages: 10 },
		}, dispatchOpts)

		const headers = mockFetch.mock.calls[0][1].headers
		expect(headers['Content-Type']).toBe('application/json')
		expect(headers['X-Signature']).toMatch(/^[a-f0-9]{64}$/)
		expect(headers['X-Timestamp']).toMatch(/^\d+$/)
	})

	it('throws when response is not ok and includes response body', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 400,
			statusText: 'Bad Request',
			text: () => Promise.resolve('Invalid job config'),
		})
		vi.stubGlobal('fetch', mockFetch)

		await expect(
			dispatchScrapeJob({
				jobId: 'j1',
				callbackUrl: 'http://localhost/webhooks/ingest/batch',
				config: { jobType: 'web_crawl', seedUrls: ['https://example.com'], maxPages: 10 },
			}, dispatchOpts),
		).rejects.toThrow('400 Bad Request: Invalid job config')
	})

	it('handles non-JSON success responses gracefully', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.reject(new SyntaxError('Unexpected end')),
		})
		vi.stubGlobal('fetch', mockFetch)

		const result = await dispatchScrapeJob({
			jobId: 'j1',
			callbackUrl: 'http://localhost/webhooks/ingest/batch',
			config: { jobType: 'web_crawl', seedUrls: ['https://example.com'], maxPages: 10 },
		}, dispatchOpts)

		expect(result).toEqual({ status: 'dispatched' })
	})
})
