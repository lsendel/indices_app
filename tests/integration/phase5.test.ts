import { describe, it, expect, vi } from 'vitest'
import { hashContent, deduplicateArticles } from '../../src/services/scraper/dedup'
import { normalizeBatchToArticles } from '../../src/services/sentiment/ingestion'
import { isDue, parseCronSchedule, type FeedSubscription } from '../../src/services/scraper/feed-manager'
import { enrichArticles } from '../../src/services/scraper/enrichment'
import type { OpenAIAdapter } from '../../src/adapters/openai'

describe('Phase 5 Integration: Scraper Pipeline', () => {
	it('end-to-end: batch → normalize → dedup → enrich', async () => {
		// Step 1: Simulate batch from Rust worker
		const batch = {
			job_id: 'job-1',
			batch_index: 0,
			is_final: true,
			pages: [
				{ url: 'https://techcrunch.com/article1', title: 'New AI Product Launch', content: 'AcmeCorp launched their new AI product today.', content_hash: undefined },
				{ url: 'https://techcrunch.com/article2', title: 'New AI Product Launch', content: 'AcmeCorp launched their new AI product today.', content_hash: undefined },
			],
			posts: [
				{
					platform: 'reddit',
					title: 'AcmeCorp just launched something big',
					content: 'Check out the new AcmeCorp AI product, it looks amazing!',
					author: 'redditor42',
					url: 'https://reddit.com/r/tech/abc',
					engagement: { upvotes: 142, comments: 23 },
					posted_at: '2026-02-20T12:00:00Z',
				},
			],
		}

		// Step 2: Normalize
		const normalized = normalizeBatchToArticles(batch, 'tenant-1')
		expect(normalized).toHaveLength(3)
		expect(normalized[0].source).toBe('web')
		expect(normalized[2].source).toBe('reddit')

		// Step 3: Deduplicate (articles 1 and 2 have same content → same hash)
		const unique = deduplicateArticles(normalized)
		// Article 1 and 2 have identical content, so one gets deduped
		expect(unique.length).toBeLessThan(3)

		// Step 4: Verify content hashing consistency
		const hash1 = hashContent('test content')
		const hash2 = hashContent('test content')
		expect(hash1).toBe(hash2)
		expect(hash1).toHaveLength(64)

		// Step 5: Simulate enrichment
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockResolvedValue({ score: 0.8, themes: ['innovation', 'AI'] }),
			generateContent: vi.fn(),
		}

		const enrichable = unique
			.filter(a => a.content)
			.map((a, i) => ({
				id: `article-${i}`,
				title: a.title,
				content: a.content,
				brand: 'AcmeCorp',
			}))

		const enriched = await enrichArticles(adapter, enrichable)
		expect(enriched.length).toBeGreaterThan(0)
		expect(enriched[0].sentiment.score).toBe(0.8)
		expect(enriched[0].sentiment.themes).toContain('AI')
	})

	it('feed scheduling: cron parsing + due detection', () => {
		// Parse cron schedules
		expect(parseCronSchedule('0 */6 * * *')).toBe(6 * 60 * 60 * 1000)
		expect(parseCronSchedule('0 */12 * * *')).toBe(12 * 60 * 60 * 1000)
		expect(parseCronSchedule('0 0 * * *')).toBe(24 * 60 * 60 * 1000)

		// Due detection
		const neverFetched: FeedSubscription = {
			id: 'f1',
			schedule: '0 */6 * * *',
			active: true,
			lastFetchedAt: null,
		}
		expect(isDue(neverFetched)).toBe(true)

		const recentlyFetched: FeedSubscription = {
			id: 'f2',
			schedule: '0 */6 * * *',
			active: true,
			lastFetchedAt: new Date(),
		}
		expect(isDue(recentlyFetched)).toBe(false)

		const staleFeed: FeedSubscription = {
			id: 'f3',
			schedule: '0 */6 * * *',
			active: true,
			lastFetchedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
		}
		expect(isDue(staleFeed)).toBe(true)
	})

	it('deduplication removes cross-source duplicates', () => {
		const articles = [
			{
				tenantId: 't1', source: 'web' as const, title: 'Same Article',
				content: 'Content A', url: 'https://site1.com', author: null,
				contentHash: 'hash-same', metadata: {}, publishedAt: null,
			},
			{
				tenantId: 't1', source: 'rss' as const, title: 'Same Article (RSS)',
				content: 'Content A', url: 'https://site2.com', author: null,
				contentHash: 'hash-same', metadata: {}, publishedAt: null,
			},
			{
				tenantId: 't1', source: 'reddit' as const, title: 'Different Article',
				content: 'Content B', url: 'https://reddit.com/xyz', author: null,
				contentHash: 'hash-different', metadata: {}, publishedAt: null,
			},
		]

		const unique = deduplicateArticles(articles)
		expect(unique).toHaveLength(2)
		expect(unique[0].title).toBe('Same Article')
		expect(unique[1].title).toBe('Different Article')
	})
})
