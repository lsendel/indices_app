import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { scrapeJobs } from '../db/schema'
import { getDb } from '../db/client'
import { scrapeJobDispatch } from '../types/api'
import { NotFoundError } from '../types/errors'
import { createJob, getJobStatus, cancelJob } from '../services/scraper/job-tracker'
import { dispatchScrapeJob } from '../services/scraper/dispatcher'
import { getConfig } from '../config'

export function createScraperRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/jobs', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const items = await db.select().from(scrapeJobs).where(eq(scrapeJobs.tenantId, tenantId)).orderBy(desc(scrapeJobs.createdAt))
		return c.json({ items })
	})

	router.post('/jobs', validate('json', scrapeJobDispatch), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const config = getConfig()
		const callbackUrl = `${config.BETTER_AUTH_URL}/api/v1/ingest/batch`

		const job = await createJob(tenantId, {
			jobType: data.jobType, seedUrls: data.seedUrls, subreddits: data.subreddits,
			keywords: data.keywords, maxPages: data.maxPages, feedSubscriptionId: data.feedSubscriptionId,
		}, callbackUrl)

		dispatchScrapeJob({
			jobId: job.id, callbackUrl,
			config: { jobType: data.jobType, seedUrls: data.seedUrls, subreddits: data.subreddits, keywords: data.keywords, maxPages: data.maxPages },
		}).catch(err => console.error('Failed to dispatch scrape job', { jobId: job.id, error: err }))

		return c.json(job, 201)
	})

	router.get('/jobs/:id', async (c) => {
		const tenantId = c.get('tenantId')!
		const job = await getJobStatus(c.req.param('id'), tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', c.req.param('id'))
		return c.json(job)
	})

	router.post('/jobs/:id/cancel', async (c) => {
		const tenantId = c.get('tenantId')!
		const job = await cancelJob(c.req.param('id'), tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', c.req.param('id'))
		return c.json(job)
	})

	return router
}
