import { describe, it, expect } from 'vitest'
import { parseCronSchedule, isDue, type FeedScheduleInfo } from '../../../src/services/scraper/feed-manager'

describe('parseCronSchedule', () => {
	it('parses "0 */6 * * *" as 6 hours', () => {
		expect(parseCronSchedule('0 */6 * * *')).toBe(6 * 60 * 60 * 1000)
	})

	it('parses "0 0 * * *" as 24 hours', () => {
		expect(parseCronSchedule('0 0 * * *')).toBe(24 * 60 * 60 * 1000)
	})

	it('defaults to 6 hours for unrecognized', () => {
		expect(parseCronSchedule('weird')).toBe(6 * 60 * 60 * 1000)
	})
})

describe('isDue', () => {
	it('returns true when never fetched', () => {
		expect(isDue({ id: 'f1', schedule: '0 */6 * * *', active: true, lastFetchedAt: null })).toBe(true)
	})

	it('returns true when interval exceeded', () => {
		expect(isDue({ id: 'f1', schedule: '0 */6 * * *', active: true, lastFetchedAt: new Date(Date.now() - 7 * 3600000) })).toBe(true)
	})

	it('returns false when recently fetched', () => {
		expect(isDue({ id: 'f1', schedule: '0 */6 * * *', active: true, lastFetchedAt: new Date() })).toBe(false)
	})

	it('returns false for inactive feeds', () => {
		expect(isDue({ id: 'f1', schedule: '0 */6 * * *', active: false, lastFetchedAt: null })).toBe(false)
	})
})
