import { Hono } from 'hono'
import { eq, count } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { getDb } from '../db/client'
import { prospects, campaigns, experiments, workflows, scrapeJobs, feedSubscriptions } from '../db/schema'

export function createAnalyticsRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/dashboard', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const [prospectCount] = await db.select({ count: count() }).from(prospects).where(eq(prospects.tenantId, tenantId))
		const [campaignCount] = await db.select({ count: count() }).from(campaigns).where(eq(campaigns.tenantId, tenantId))
		const [experimentCount] = await db.select({ count: count() }).from(experiments).where(eq(experiments.tenantId, tenantId))
		const [workflowCount] = await db.select({ count: count() }).from(workflows).where(eq(workflows.tenantId, tenantId))
		const [jobCount] = await db.select({ count: count() }).from(scrapeJobs).where(eq(scrapeJobs.tenantId, tenantId))
		const [feedCount] = await db.select({ count: count() }).from(feedSubscriptions).where(eq(feedSubscriptions.tenantId, tenantId))

		return c.json({
			prospects: { total: prospectCount?.count ?? 0 },
			campaigns: { total: campaignCount?.count ?? 0 },
			experiments: { total: experimentCount?.count ?? 0 },
			workflows: { total: workflowCount?.count ?? 0 },
			scrapeJobs: { total: jobCount?.count ?? 0 },
			feeds: { total: feedCount?.count ?? 0 },
		})
	})

	return router
}
