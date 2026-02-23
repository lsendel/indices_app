import { describe, it, expect, vi } from 'vitest'
import { processBatch } from '../../../src/services/scraper/batch-handler'
import type { BatchPayload } from '../../../src/types/api'

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
	it('processes web pages and returns result', async () => {
		const batch: BatchPayload = {
			job_id: 'job-1',
			batch_index: 0,
			is_final: false,
			pages: [
				{ url: 'https://example.com/1', title: 'Article 1', content: 'Content 1' },
				{ url: 'https://example.com/2', title: 'Article 2', content: 'Content 2' },
			],
		}
		const result = await processBatch(batch, 'tenant-1')
		expect(result.processed).toBe(2)
		expect(result.jobId).toBe('job-1')
	})

	it('processes social posts', async () => {
		const batch: BatchPayload = {
			job_id: 'job-2',
			batch_index: 0,
			is_final: true,
			posts: [{ platform: 'reddit', title: 'Post', content: 'Content', author: 'user1' }],
		}
		const result = await processBatch(batch, 'tenant-1')
		expect(result.processed).toBeGreaterThanOrEqual(1)
	})

	it('returns zero for empty batch', async () => {
		const result = await processBatch({ job_id: 'j3', batch_index: 0, is_final: true }, 'tenant-1')
		expect(result.processed).toBe(0)
	})
})
