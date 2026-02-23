import { describe, it, expect, vi } from 'vitest'
import { createJob, getJobStatus, cancelJob } from '../../../src/services/scraper/job-tracker'

const mockDb = {
	insert: vi.fn().mockReturnValue({
		values: vi.fn().mockReturnValue({
			returning: vi.fn().mockResolvedValue([{ id: 'job-new', tenantId: 't1', jobType: 'web_crawl', status: 'pending', createdAt: new Date() }]),
		}),
	}),
	select: vi.fn().mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([{ id: 'job-1', tenantId: 't1', status: 'running', pagesScraped: 10 }]),
		}),
	}),
	update: vi.fn().mockReturnValue({
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 'job-1', status: 'cancelled' }]),
			}),
		}),
	}),
}

vi.mock('../../../src/db/client', () => ({ getDb: () => mockDb }))

describe('job tracker', () => {
	it('creates a scrape job', async () => {
		const job = await createJob('t1', { jobType: 'web_crawl', seedUrls: ['https://example.com'] }, 'https://cb.example.com')
		expect(job.status).toBe('pending')
	})

	it('gets job status', async () => {
		const job = await getJobStatus('job-1', 't1')
		expect(job?.status).toBe('running')
	})

	it('cancels a job', async () => {
		const result = await cancelJob('job-1', 't1')
		expect(result?.status).toBe('cancelled')
	})
})
