import { Hono } from 'hono'
import { eq, count, and, gte, desc, avg, sql, sum } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { prospects, campaigns, experiments, workflows, scrapeJobs, feedSubscriptions, publishedContent, engagementEvents, sentimentArticles } from '../db/schema'

export function createAnalyticsRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/dashboard', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!

		const [prospectCount] = await db.select({ count: count() }).from(prospects).where(eq(prospects.tenantId, tenantId))
		const [campaignCount] = await db.select({ count: count() }).from(campaigns).where(eq(campaigns.tenantId, tenantId))
		const [experimentCount] = await db.select({ count: count() }).from(experiments).where(eq(experiments.tenantId, tenantId))
		const [workflowCount] = await db.select({ count: count() }).from(workflows).where(eq(workflows.tenantId, tenantId))
		const [jobCount] = await db.select({ count: count() }).from(scrapeJobs).where(eq(scrapeJobs.tenantId, tenantId))
		const [feedCount] = await db.select({ count: count() }).from(feedSubscriptions).where(eq(feedSubscriptions.tenantId, tenantId))
		const [contentCount] = await db.select({ count: count() }).from(publishedContent).where(eq(publishedContent.tenantId, tenantId))

		return c.json({
			prospects: { total: prospectCount?.count ?? 0 },
			campaigns: { total: campaignCount?.count ?? 0 },
			experiments: { total: experimentCount?.count ?? 0 },
			workflows: { total: workflowCount?.count ?? 0 },
			scrapeJobs: { total: jobCount?.count ?? 0 },
			feeds: { total: feedCount?.count ?? 0 },
			publishedContent: { total: contentCount?.count ?? 0 },
		})
	})

	// Engagement analytics — aggregate events by type over a time window
	router.get('/engagement', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const days = parseInt(c.req.query('days') ?? '30', 10)
		const since = new Date(Date.now() - days * 86_400_000)

		const byType = await db
			.select({
				eventType: engagementEvents.eventType,
				total: sum(engagementEvents.count),
			})
			.from(engagementEvents)
			.where(
				and(
					eq(engagementEvents.tenantId, tenantId),
					gte(engagementEvents.recordedAt, since),
				),
			)
			.groupBy(engagementEvents.eventType)

		const [totalEvents] = await db
			.select({ count: count() })
			.from(engagementEvents)
			.where(
				and(
					eq(engagementEvents.tenantId, tenantId),
					gte(engagementEvents.recordedAt, since),
				),
			)

		return c.json({
			period: `${days} days`,
			totalEvents: totalEvents?.count ?? 0,
			byType: byType.map((r) => ({ eventType: r.eventType, total: Number(r.total ?? 0) })),
		})
	})

	// Content performance — top published content by engagement
	router.get('/content-performance', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const limit = Math.min(parseInt(c.req.query('limit') ?? '20', 10), 100)

		const topContent = await db
			.select({
				publishedContentId: engagementEvents.publishedContentId,
				platform: engagementEvents.platform,
				totalEngagement: sum(engagementEvents.count),
			})
			.from(engagementEvents)
			.where(eq(engagementEvents.tenantId, tenantId))
			.groupBy(engagementEvents.publishedContentId, engagementEvents.platform)
			.orderBy(desc(sql`sum(${engagementEvents.count})`))
			.limit(limit)

		return c.json({
			items: topContent.map((r) => ({
				publishedContentId: r.publishedContentId,
				platform: r.platform,
				totalEngagement: Number(r.totalEngagement ?? 0),
			})),
		})
	})

	// Sentiment trends — average sentiment over time
	router.get('/sentiment-trends', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const days = parseInt(c.req.query('days') ?? '30', 10)
		const since = new Date(Date.now() - days * 86_400_000)

		const trends = await db
			.select({
				date: sql<string>`date(${sentimentArticles.analyzedAt})`.as('date'),
				avgScore: avg(sentimentArticles.sentimentScore),
				articleCount: count(),
			})
			.from(sentimentArticles)
			.where(
				and(
					eq(sentimentArticles.tenantId, tenantId),
					gte(sentimentArticles.analyzedAt, since),
				),
			)
			.groupBy(sql`date(${sentimentArticles.analyzedAt})`)
			.orderBy(sql`date(${sentimentArticles.analyzedAt})`)

		return c.json({
			period: `${days} days`,
			trends: trends.map((r) => ({
				date: r.date,
				avgScore: Number(r.avgScore ?? 0),
				articleCount: r.articleCount,
			})),
		})
	})

	return router
}
