import { Hono } from 'hono'
import { eq, and, desc, count } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { engagementEvents, publishedContent, platformConnections } from '../db/schema'
import { pollEngagement } from '../services/engagement/poller'
import { scoreEngagement } from '../services/engagement/scorer'
import type { PlatformConnection } from '../adapters/platforms/types'

export function createEngagementRoutes() {
	const router = new Hono<AppEnv>()

	// Poll engagement for all published content with platform connections
	router.post('/poll', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const loopSystem = c.var.loopSystem

		// Find published content that has a platformContentId (i.e. actually published)
		const published = await db
			.select()
			.from(publishedContent)
			.where(
				and(
					eq(publishedContent.tenantId, tenantId),
					eq(publishedContent.status, 'published'),
				),
			)

		const connections = await db
			.select()
			.from(platformConnections)
			.where(eq(platformConnections.tenantId, tenantId))

		const connectionMap = new Map(connections.map((c) => [c.platform, c]))

		// Build poll targets — only content that has matching platform connections
		const targets = published
			.filter((p) => p.platformContentId && connectionMap.has(p.platform))
			.map((p) => ({
				publishedContentId: p.id,
				platformContentId: p.platformContentId!,
				platform: p.platform,
				connection: connectionMap.get(p.platform)! as unknown as PlatformConnection,
			}))

		if (targets.length === 0) {
			return c.json({ polled: 0, message: 'No published content with platform connections to poll' })
		}

		const results = await pollEngagement(targets)

		// Store engagement events and compute scores
		let stored = 0
		for (const result of results) {
			const score = scoreEngagement(result.metrics)

			// Store individual metric events
			const metricEntries = Object.entries(result.metrics).filter(([, v]) => v > 0)
			for (const [eventType, count_] of metricEntries) {
				const mappedType = mapMetricToEventType(eventType)
				if (!mappedType) continue
				await db.insert(engagementEvents).values({
					tenantId,
					publishedContentId: result.publishedContentId,
					platform: result.platform,
					eventType: mappedType,
					count: count_,
				})
				stored++
			}

			// Emit to event bus if loop system is available
			if (loopSystem) {
				const [totalCount] = await db
					.select({ count: count() })
					.from(engagementEvents)
					.where(
						and(
							eq(engagementEvents.tenantId, tenantId),
							eq(engagementEvents.publishedContentId, result.publishedContentId),
						),
					)

				await loopSystem.watchers.engagement.onEngagementCollected(tenantId, {
					publishedContentId: result.publishedContentId,
					channel: result.platform,
					score,
					totalEvents: totalCount?.count ?? 0,
				})
			}
		}

		return c.json({ polled: results.length, stored })
	})

	// Collect engagement for a single published content item
	router.post('/collect/:publishedContentId', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const publishedContentId = c.req.param('publishedContentId')
		const loopSystem = c.var.loopSystem

		const [item] = await db
			.select()
			.from(publishedContent)
			.where(
				and(
					eq(publishedContent.id, publishedContentId),
					eq(publishedContent.tenantId, tenantId),
				),
			)
			.limit(1)

		if (!item || !item.platformContentId) {
			return c.json({ error: 'Published content not found or not yet published' }, 404)
		}

		const [connection] = await db
			.select()
			.from(platformConnections)
			.where(
				and(
					eq(platformConnections.tenantId, tenantId),
					eq(platformConnections.platform, item.platform as any),
				),
			)
			.limit(1)

		if (!connection) {
			return c.json({ error: 'No platform connection found for this content' }, 404)
		}

		const targets = [{
			publishedContentId: item.id,
			platformContentId: item.platformContentId,
			platform: item.platform,
			connection: connection as unknown as PlatformConnection,
		}]

		const [result] = await pollEngagement(targets)
		const score = scoreEngagement(result.metrics)

		// Store engagement events
		const metricEntries = Object.entries(result.metrics).filter(([, v]) => v > 0)
		for (const [eventType, count_] of metricEntries) {
			const mappedType = mapMetricToEventType(eventType)
			if (!mappedType) continue
			await db.insert(engagementEvents).values({
				tenantId,
				publishedContentId,
				platform: item.platform,
				eventType: mappedType,
				count: count_,
			})
		}

		// Emit to event bus
		if (loopSystem) {
			const [totalCount] = await db
				.select({ count: count() })
				.from(engagementEvents)
				.where(
					and(
						eq(engagementEvents.tenantId, tenantId),
						eq(engagementEvents.publishedContentId, publishedContentId),
					),
				)

			await loopSystem.watchers.engagement.onEngagementCollected(tenantId, {
				publishedContentId,
				channel: item.platform,
				score,
				totalEvents: totalCount?.count ?? 0,
			})
		}

		return c.json({ metrics: result.metrics, score })
	})

	// Aggregate summary (must be before /:publishedContentId)
	router.get('/summary', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!

		const summary = await db
			.select()
			.from(engagementEvents)
			.where(eq(engagementEvents.tenantId, tenantId))
			.orderBy(desc(engagementEvents.recordedAt))
			.limit(1000)

		return c.json({ summary })
	})

	// Top performing content (must be before /:publishedContentId)
	router.get('/leaderboard', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!

		const leaderboard = await db
			.select()
			.from(engagementEvents)
			.where(eq(engagementEvents.tenantId, tenantId))
			.orderBy(desc(engagementEvents.recordedAt))
			.limit(50)

		return c.json({ leaderboard })
	})

	// Metrics for specific published content
	router.get('/:publishedContentId', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const publishedContentId = c.req.param('publishedContentId')

		const events = await db
			.select()
			.from(engagementEvents)
			.where(
				and(
					eq(engagementEvents.tenantId, tenantId),
					eq(engagementEvents.publishedContentId, publishedContentId),
				),
			)
			.orderBy(desc(engagementEvents.recordedAt))

		return c.json({ events })
	})

	return router
}

function mapMetricToEventType(metric: string): 'view' | 'like' | 'share' | 'comment' | 'click' | 'save' | 'conversion' | null {
	const map: Record<string, 'view' | 'like' | 'share' | 'comment' | 'click' | 'save' | 'conversion'> = {
		views: 'view',
		likes: 'like',
		shares: 'share',
		comments: 'comment',
		clicks: 'click',
		saves: 'save',
		conversions: 'conversion',
	}
	return map[metric] ?? null
}
