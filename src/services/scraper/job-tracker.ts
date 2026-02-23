import { eq, and } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { scrapeJobs } from '../../db/schema'

export interface JobConfig {
	jobType: 'web_crawl' | 'social_scrape' | 'feed_ingest'
	seedUrls?: string[]
	subreddits?: string[]
	keywords?: string[]
	maxPages?: number
	feedSubscriptionId?: string
}

export async function createJob(tenantId: string, config: JobConfig, callbackUrl: string) {
	const db = getDb()
	const [job] = await db.insert(scrapeJobs).values({ tenantId, jobType: config.jobType, config, callbackUrl }).returning()
	return job
}

export async function getJobStatus(jobId: string, tenantId: string) {
	const db = getDb()
	const [job] = await db.select().from(scrapeJobs).where(and(eq(scrapeJobs.id, jobId), eq(scrapeJobs.tenantId, tenantId)))
	return job ?? null
}

export async function cancelJob(jobId: string, tenantId: string) {
	const db = getDb()
	const [updated] = await db.update(scrapeJobs).set({ status: 'cancelled' }).where(and(eq(scrapeJobs.id, jobId), eq(scrapeJobs.tenantId, tenantId))).returning()
	return updated ?? null
}

export async function completeJob(jobId: string, pagesScraped: number) {
	const db = getDb()
	await db.update(scrapeJobs).set({ status: 'completed', pagesScraped, completedAt: new Date() }).where(eq(scrapeJobs.id, jobId))
}

export async function failJob(jobId: string, errorMessage: string) {
	const db = getDb()
	await db.update(scrapeJobs).set({ status: 'failed', errorMessage, completedAt: new Date() }).where(eq(scrapeJobs.id, jobId))
}
