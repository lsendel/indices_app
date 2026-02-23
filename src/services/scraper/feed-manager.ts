import { eq, and, sql } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { feedSubscriptions } from '../../db/schema'
import { logger } from '../../utils/logger'

export interface FeedSubscription {
	id: string
	schedule: string
	active: boolean
	lastFetchedAt: Date | null
}

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000 // 6 hours

/** Parse simplified cron schedule to interval in milliseconds. */
export function parseCronSchedule(schedule: string): number {
	// Match "0 */N * * *" → every N hours
	const hourly = schedule.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/)
	if (hourly) return parseInt(hourly[1]) * 60 * 60 * 1000

	// Match "0 0 * * *" → daily
	if (schedule.match(/^0\s+0\s+\*\s+\*\s+\*$/)) return 24 * 60 * 60 * 1000

	return DEFAULT_INTERVAL_MS
}

/** Check if a feed subscription is due for fetching. */
export function isDue(feed: FeedSubscription): boolean {
	if (!feed.active) return false
	if (!feed.lastFetchedAt) return true

	const interval = parseCronSchedule(feed.schedule)
	return Date.now() - feed.lastFetchedAt.getTime() >= interval
}

/** Get all active feed subscriptions for a tenant. */
export async function getActiveFeeds(tenantId: string) {
	const db = getDb()
	return db
		.select()
		.from(feedSubscriptions)
		.where(and(eq(feedSubscriptions.tenantId, tenantId), eq(feedSubscriptions.active, true)))
}

/** Get feeds that are due for fetching. */
export async function getDueFeeds(tenantId: string): Promise<FeedSubscription[]> {
	const feeds = await getActiveFeeds(tenantId)
	return feeds.filter(f => isDue({
		id: f.id,
		schedule: f.schedule,
		active: f.active,
		lastFetchedAt: f.lastFetchedAt,
	}))
}

/** Mark a feed as fetched with current timestamp and optional content hash. */
export async function markFetched(feedId: string, contentHash?: string) {
	const db = getDb()
	await db
		.update(feedSubscriptions)
		.set({
			lastFetchedAt: new Date(),
			lastContentHash: contentHash,
			errorCount: 0,
			lastError: null,
			updatedAt: new Date(),
		})
		.where(eq(feedSubscriptions.id, feedId))
}

/** Atomically increment error count on a feed subscription. Deactivates after 5 consecutive errors. */
export async function recordFeedError(feedId: string, error: string) {
	const db = getDb()
	const [updated] = await db
		.update(feedSubscriptions)
		.set({
			errorCount: sql`${feedSubscriptions.errorCount} + 1`,
			lastError: error,
			active: sql`CASE WHEN ${feedSubscriptions.errorCount} + 1 >= 5 THEN false ELSE ${feedSubscriptions.active} END`,
			updatedAt: new Date(),
		})
		.where(eq(feedSubscriptions.id, feedId))
		.returning()

	if (updated && !updated.active) {
		logger.warn({ feedId, errorCount: updated.errorCount }, 'Feed deactivated after consecutive errors')
	}
}
