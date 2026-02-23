import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { feedSubscriptions } from '../../db/schema'

export interface FeedScheduleInfo {
	id: string
	schedule: string
	active: boolean
	lastFetchedAt: Date | null
}

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000

export function parseCronSchedule(schedule: string): number {
	const hourly = schedule.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/)
	if (hourly) return parseInt(hourly[1]) * 60 * 60 * 1000
	if (schedule.match(/^0\s+0\s+\*\s+\*\s+\*$/)) return 24 * 60 * 60 * 1000
	return DEFAULT_INTERVAL_MS
}

export function isDue(feed: FeedScheduleInfo): boolean {
	if (!feed.active) return false
	if (!feed.lastFetchedAt) return true
	return Date.now() - feed.lastFetchedAt.getTime() >= parseCronSchedule(feed.schedule)
}

export async function markFetched(feedId: string, contentHash?: string) {
	const db = getDb()
	await db.update(feedSubscriptions).set({
		lastFetchedAt: new Date(), lastContentHash: contentHash, errorCount: 0, lastError: null, updatedAt: new Date(),
	}).where(eq(feedSubscriptions.id, feedId))
}

export async function recordFeedError(feedId: string, error: string) {
	const db = getDb()
	const [feed] = await db.select().from(feedSubscriptions).where(eq(feedSubscriptions.id, feedId))
	if (!feed) return
	const newCount = feed.errorCount + 1
	await db.update(feedSubscriptions).set({
		errorCount: newCount, lastError: error, active: newCount >= 5 ? false : feed.active, updatedAt: new Date(),
	}).where(eq(feedSubscriptions.id, feedId))
}
