import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { scrapeJobs } from '../db/schema'
import { scrapeJobDispatch } from '../types/api'
import { NotFoundError } from '../types/errors'
import { createJob, getJobStatus, cancelJob, failJob } from '../services/scraper/job-tracker'
import { dispatchScrapeJob } from '../services/scraper/dispatcher'
import { logger } from '../utils/logger'

export function createScraperRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/jobs', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const items = await db.select().from(scrapeJobs).where(eq(scrapeJobs.tenantId, tenantId)).orderBy(desc(scrapeJobs.createdAt))
		return c.json({ items })
	})

	router.post('/jobs', validate('json', scrapeJobDispatch), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const callbackUrl = `${c.env.BETTER_AUTH_URL}/webhooks/ingest/batch`

		const job = await createJob(db, tenantId, data, callbackUrl)

		dispatchScrapeJob({
			jobId: job.id,
			callbackUrl,
			config: data,
		}, {
			scraperWorkerUrl: c.env.SCRAPER_WORKER_URL || 'http://localhost:8080',
			scraperSharedSecret: c.env.SCRAPER_SHARED_SECRET || 'dev-secret',
		}).catch(async (err) => {
			logger.error('Failed to dispatch scrape job', { jobId: job.id, error: String(err) })
			failJob(db, job.id, err instanceof Error ? err.message : 'Dispatch failed').catch(() => {})
		})

		return c.json(job, 201)
	})

	router.get('/jobs/:id', async (c) => {
		const tenantId = c.get('tenantId')!
		const job = await getJobStatus(c.var.db, c.req.param('id'), tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', c.req.param('id'))
		return c.json(job)
	})

	router.post('/jobs/:id/cancel', async (c) => {
		const tenantId = c.get('tenantId')!
		const job = await cancelJob(c.var.db, c.req.param('id'), tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', c.req.param('id'))
		return c.json(job)
	})

	return router
}
