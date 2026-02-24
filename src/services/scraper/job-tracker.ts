import { eq, and, inArray } from 'drizzle-orm'
import type { Database } from '../../db/client'
import { scrapeJobs } from '../../db/schema'
import type { ScrapeJobDispatch } from '../../types/api'

export type JobConfig = ScrapeJobDispatch

export async function createJob(db: Database, tenantId: string, config: ScrapeJobDispatch, callbackUrl: string) {
	const [job] = await db.insert(scrapeJobs).values({ tenantId, jobType: config.jobType, config, callbackUrl }).returning()
	return job
}

export async function getJobStatus(db: Database, jobId: string, tenantId: string) {
	const [job] = await db.select().from(scrapeJobs).where(and(eq(scrapeJobs.id, jobId), eq(scrapeJobs.tenantId, tenantId)))
	return job ?? null
}

export async function cancelJob(db: Database, jobId: string, tenantId: string) {
	const [updated] = await db.update(scrapeJobs)
		.set({ status: 'cancelled' })
		.where(and(
			eq(scrapeJobs.id, jobId),
			eq(scrapeJobs.tenantId, tenantId),
			inArray(scrapeJobs.status, ['pending', 'queued', 'running']),
		))
		.returning()
	return updated ?? null
}

export async function completeJob(db: Database, jobId: string, pagesScraped: number) {
	await db.update(scrapeJobs).set({ status: 'completed', pagesScraped, completedAt: new Date() }).where(eq(scrapeJobs.id, jobId))
}

export async function failJob(db: Database, jobId: string, errorMessage: string) {
	await db.update(scrapeJobs).set({ status: 'failed', errorMessage, completedAt: new Date() }).where(eq(scrapeJobs.id, jobId))
}
