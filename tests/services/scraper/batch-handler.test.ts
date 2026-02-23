import { describe, it, expect, vi } from 'vitest'
import { processBatch, type BatchPayload } from '../../../src/services/scraper/batch-handler'

vi.mock('../../../src/utils/logger', () => ({
	logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const mockDb = {
	select: vi.fn().mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([]),
		}),
	}),
	insert: vi.fn().mockReturnValue({
		values: vi.fn().mockReturnValue({
			onConflictDoNothing: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 'new-1' }]),
			}),
		}),
	}),
	update: vi.fn().mockReturnValue({
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	}),
}

vi.mock('../../../src/db/client', () => ({
	getDb: () => mockDb,
}))

describe('processBatch', () => {
	const webBatch: BatchPayload = {
		job_id: 'job-1',
		batch_index: 0,
		is_final: false,
		pages: [
			{ url: 'https://example.com/1', title: 'Article 1', content: 'Content 1' },
			{ url: 'https://example.com/2', title: 'Article 2', content: 'Content 2' },
		],
	}

	const socialBatch: BatchPayload = {
		job_id: 'job-2',
		batch_index: 0,
		is_final: true,
		posts: [
			{
				platform: 'reddit',
				title: 'Reddit Post',
				content: 'Post content',
				author: 'user1',
				url: 'https://reddit.com/r/test/123',
				engagement: { upvotes: 42 },
				posted_at: '2026-02-20T00:00:00Z',
			},
		],
	}

	it('processes web pages and returns insert count', async () => {
		const result = await processBatch(webBatch, 'tenant-1')
		expect(result.processed).toBe(2)
		expect(result.deduplicated).toBe(0)
		expect(result.jobId).toBe('job-1')
	})

	it('processes social posts', async () => {
		const result = await processBatch(socialBatch, 'tenant-1')
		expect(result.processed).toBeGreaterThanOrEqual(1)
		expect(result.jobId).toBe('job-2')
	})

	it('returns zero for empty batch', async () => {
		const emptyBatch: BatchPayload = {
			job_id: 'job-3',
			batch_index: 0,
			is_final: true,
		}
		const result = await processBatch(emptyBatch, 'tenant-1')
		expect(result.processed).toBe(0)
	})
})
