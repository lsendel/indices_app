import { describe, it, expect, vi } from 'vitest'
import {
	isDue,
	parseCronSchedule,
	type FeedSubscription,
} from '../../../src/services/scraper/feed-manager'

vi.mock('../../../src/utils/logger', () => ({
	logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

describe('parseCronSchedule', () => {
	it('parses "0 */6 * * *" as every 6 hours interval', () => {
		const interval = parseCronSchedule('0 */6 * * *')
		expect(interval).toBe(6 * 60 * 60 * 1000)
	})

	it('parses "0 */12 * * *" as every 12 hours', () => {
		expect(parseCronSchedule('0 */12 * * *')).toBe(12 * 60 * 60 * 1000)
	})

	it('parses "0 0 * * *" as every 24 hours (daily)', () => {
		expect(parseCronSchedule('0 0 * * *')).toBe(24 * 60 * 60 * 1000)
	})

	it('defaults to 6 hours for unrecognized patterns', () => {
		expect(parseCronSchedule('weird cron')).toBe(6 * 60 * 60 * 1000)
	})
})

describe('isDue', () => {
	it('returns true when never fetched', () => {
		const feed: FeedSubscription = {
			id: 'f1',
			schedule: '0 */6 * * *',
			active: true,
			lastFetchedAt: null,
		}
		expect(isDue(feed)).toBe(true)
	})

	it('returns true when enough time has passed', () => {
		const feed: FeedSubscription = {
			id: 'f1',
			schedule: '0 */6 * * *',
			active: true,
			lastFetchedAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
		}
		expect(isDue(feed)).toBe(true)
	})

	it('returns false when not enough time has passed', () => {
		const feed: FeedSubscription = {
			id: 'f1',
			schedule: '0 */6 * * *',
			active: true,
			lastFetchedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
		}
		expect(isDue(feed)).toBe(false)
	})

	it('returns false for inactive feeds', () => {
		const feed: FeedSubscription = {
			id: 'f1',
			schedule: '0 */6 * * *',
			active: false,
			lastFetchedAt: null,
		}
		expect(isDue(feed)).toBe(false)
	})
})
