import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { scrapeJobs } from '../db/schema'
import { getDb } from '../db/client'
import { scrapeJobDispatch } from '../types/api'
import { NotFoundError } from '../types/errors'
import { createJob, getJobStatus, cancelJob, failJob } from '../services/scraper/job-tracker'
import { dispatchScrapeJob } from '../services/scraper/dispatcher'
import { getConfig } from '../config'
import { logger } from '../utils/logger'

export function createScraperRoutes() {
	const router = new Hono<AppEnv>()

	// List scrape jobs
	router.get('/jobs', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(scrapeJobs)
			.where(eq(scrapeJobs.tenantId, tenantId))
			.orderBy(desc(scrapeJobs.createdAt))

		return c.json({ items })
	})

	// Dispatch a new scrape job
	router.post('/jobs', validate('json', scrapeJobDispatch), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const config = getConfig()

		const callbackUrl = `${config.BETTER_AUTH_URL}/webhooks/ingest/batch`

		const job = await createJob(tenantId, data, callbackUrl)

		// Dispatch to Rust worker (fire-and-forget)
		dispatchScrapeJob({
			jobId: job.id,
			callbackUrl,
			config: data,
		}).catch(err => {
			logger.error({ jobId: job.id, error: err }, 'Failed to dispatch scrape job')
			failJob(job.id, err instanceof Error ? err.message : 'Dispatch failed').catch(() => {})
		})

		return c.json(job, 201)
	})

	// Get job status
	router.get('/jobs/:id', async (c) => {
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const job = await getJobStatus(id, tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', id)

		return c.json(job)
	})

	// Cancel a job
	router.post('/jobs/:id/cancel', async (c) => {
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const job = await cancelJob(id, tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', id)

		return c.json(job)
	})

	return router
}
