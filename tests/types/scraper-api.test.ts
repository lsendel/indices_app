import { describe, it, expect } from 'vitest'
import {
	feedSubscriptionCreate,
	feedSubscriptionUpdate,
	scrapeJobDispatch,
	scrapeJobCancel,
} from '../../src/types/api'

describe('scraper API schemas', () => {
	it('validates feedSubscriptionCreate', () => {
		const valid = feedSubscriptionCreate.safeParse({
			name: 'TechCrunch',
			feedUrl: 'https://techcrunch.com/feed/',
			feedType: 'rss',
		})
		expect(valid.success).toBe(true)
	})

	it('rejects missing feedUrl', () => {
		const invalid = feedSubscriptionCreate.safeParse({ name: 'Test' })
		expect(invalid.success).toBe(false)
	})

	it('defaults schedule to every 6 hours', () => {
		const valid = feedSubscriptionCreate.safeParse({
			name: 'Test',
			feedUrl: 'https://example.com/feed',
		})
		expect(valid.success).toBe(true)
		expect(valid.data?.schedule).toBe('0 */6 * * *')
	})

	it('validates feedSubscriptionUpdate (partial)', () => {
		const valid = feedSubscriptionUpdate.safeParse({ active: false })
		expect(valid.success).toBe(true)
	})

	it('validates scrapeJobDispatch for web_crawl', () => {
		const valid = scrapeJobDispatch.safeParse({
			jobType: 'web_crawl',
			seedUrls: ['https://example.com'],
		})
		expect(valid.success).toBe(true)
	})

	it('validates scrapeJobDispatch for social_scrape', () => {
		const valid = scrapeJobDispatch.safeParse({
			jobType: 'social_scrape',
			subreddits: ['marketing', 'saas'],
			keywords: ['B2B'],
		})
		expect(valid.success).toBe(true)
	})

	it('validates scrapeJobDispatch for feed_ingest', () => {
		const valid = scrapeJobDispatch.safeParse({
			jobType: 'feed_ingest',
			feedSubscriptionId: '550e8400-e29b-41d4-a716-446655440000',
		})
		expect(valid.success).toBe(true)
	})

	it('rejects invalid jobType', () => {
		const invalid = scrapeJobDispatch.safeParse({ jobType: 'unknown' })
		expect(invalid.success).toBe(false)
	})

	it('validates scrapeJobCancel', () => {
		const valid = scrapeJobCancel.safeParse({
			jobId: '550e8400-e29b-41d4-a716-446655440000',
		})
		expect(valid.success).toBe(true)
	})
})
