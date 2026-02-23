import { describe, it, expect, vi } from 'vitest'
import { createJob, cancelJob, getJobStatus, type JobConfig } from '../../../src/services/scraper/job-tracker'

const mockDb = {
	insert: vi.fn().mockReturnValue({
		values: vi.fn().mockReturnValue({
			returning: vi.fn().mockImplementation(() => {
				return Promise.resolve([{
					id: 'job-new',
					tenantId: 't1',
					jobType: 'web_crawl',
					status: 'pending',
					config: {},
					callbackUrl: 'https://example.com/callback',
					pagesScraped: 0,
					createdAt: new Date(),
				}])
			}),
		}),
	}),
	select: vi.fn().mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([{
				id: 'job-1',
				tenantId: 't1',
				jobType: 'web_crawl',
				status: 'running',
				pagesScraped: 10,
			}]),
		}),
	}),
	update: vi.fn().mockReturnValue({
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{
					id: 'job-1',
					status: 'cancelled',
				}]),
			}),
		}),
	}),
}

vi.mock('../../../src/db/client', () => ({
	getDb: () => mockDb,
}))

describe('job tracker', () => {
	it('creates a new scrape job record', async () => {
		const config: JobConfig = {
			jobType: 'web_crawl',
			seedUrls: ['https://example.com'],
		}
		const job = await createJob('t1', config, 'https://example.com/callback')
		expect(job.id).toBe('job-new')
		expect(job.status).toBe('pending')
	})

	it('gets job status', async () => {
		const job = await getJobStatus('job-1', 't1')
		expect(job?.status).toBe('running')
		expect(job?.pagesScraped).toBe(10)
	})

	it('cancels a running job', async () => {
		const result = await cancelJob('job-1', 't1')
		expect(result?.status).toBe('cancelled')
	})
})
