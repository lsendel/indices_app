# Phase 5 — Rust Worker Extensions (indices_app side)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the indices_app ingestion pipeline — persist scraped batches, deduplicate content, manage RSS feed subscriptions with scheduling, track scrape job lifecycle, enrich ingested content with sentiment analysis, and expose management routes for feeds and jobs.

**Architecture:** The Rust scraper worker (separate repo, Fly.io) dispatches to 3 endpoints and streams results back in batches. The existing `dispatcher.ts` dispatches HMAC-signed jobs, `ingestion.ts` normalizes batches, and the `ingest.ts` route receives them — but doesn't persist. Phase 5 completes this: batch persistence with dedup, feed subscription CRUD, cron-style scheduled jobs, post-ingestion sentiment enrichment, and management APIs.

**Tech Stack:** Hono 4.12, Drizzle ORM (NeonDB), Zod, Vitest, existing HMAC signing (`signPayload`/`verifySignature`), existing `createOpenAIAdapter()` for enrichment, existing `normalizeBatchToArticles()` + `hashContent()`.

---

## File Map

```
src/db/schema/
  feed-subscriptions.ts    — NEW: RSS/news feed subscription table

src/services/scraper/
  dispatcher.ts            — EXISTING (already dispatches 3 job types)
  batch-handler.ts         — NEW: persist batches with dedup
  dedup.ts                 — NEW: content hash dedup service
  feed-manager.ts          — NEW: feed subscription CRUD + scheduling
  job-tracker.ts           — NEW: scrape job lifecycle management
  enrichment.ts            — NEW: post-ingestion sentiment enrichment

src/routes/
  ingest.ts                — MODIFY: wire up batch persistence
  scraper.ts               — NEW: job dispatch + management routes
  feeds.ts                 — NEW: feed subscription management routes

tests/
  (mirrors src structure)
```

---

### Task 1: Feed Subscriptions DB Schema

**Files:**
- Create: `src/db/schema/feed-subscriptions.ts`
- Modify: `src/db/schema/index.ts` (add export)
- Test: `tests/db/feed-subscriptions-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/feed-subscriptions-schema.test.ts
import { describe, it, expect } from 'vitest'
import { feedSubscriptions } from '../../src/db/schema/feed-subscriptions'

describe('feed subscriptions schema', () => {
	it('has required columns', () => {
		expect(feedSubscriptions.id).toBeDefined()
		expect(feedSubscriptions.tenantId).toBeDefined()
		expect(feedSubscriptions.name).toBeDefined()
		expect(feedSubscriptions.feedUrl).toBeDefined()
		expect(feedSubscriptions.feedType).toBeDefined()
		expect(feedSubscriptions.schedule).toBeDefined()
		expect(feedSubscriptions.active).toBeDefined()
		expect(feedSubscriptions.lastFetchedAt).toBeDefined()
		expect(feedSubscriptions.lastContentHash).toBeDefined()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/db/feed-subscriptions-schema.test.ts`
Expected: FAIL — module not found

**Step 3: Write the schema**

```typescript
// src/db/schema/feed-subscriptions.ts
import { pgTable, text, timestamp, uuid, integer, boolean, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const feedSubscriptions = pgTable('feed_subscriptions', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	feedUrl: text('feed_url').notNull(),
	feedType: text('feed_type', { enum: ['rss', 'atom', 'news'] }).default('rss').notNull(),
	schedule: text('schedule').default('0 */6 * * *').notNull(),
	active: boolean('active').default(true).notNull(),
	keywords: text('keywords'),
	maxItems: integer('max_items').default(50).notNull(),
	lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
	lastContentHash: text('last_content_hash'),
	errorCount: integer('error_count').default(0).notNull(),
	lastError: text('last_error'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_feed_subs_tenant').on(table.tenantId),
	index('idx_feed_subs_active').on(table.active),
])
```

**Step 4: Update schema index**

Append to `src/db/schema/index.ts`:

```typescript
export * from './feed-subscriptions'
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/db/feed-subscriptions-schema.test.ts`
Expected: PASS (1 test)

**Step 6: Generate migration**

Run: `bunx drizzle-kit generate`
Expected: New migration file in `src/db/migrations/`

**Step 7: Commit**

```bash
git add src/db/schema/feed-subscriptions.ts src/db/schema/index.ts \
  tests/db/feed-subscriptions-schema.test.ts src/db/migrations/
git commit -m "feat(phase5): add feed subscriptions schema"
```

---

### Task 2: Zod Validation Schemas for Phase 5 API

**Files:**
- Modify: `src/types/api.ts` (append new schemas)
- Test: `tests/types/scraper-api.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/types/scraper-api.test.ts
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
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/types/scraper-api.test.ts`
Expected: FAIL — schemas not found

**Step 3: Append schemas to api.ts**

Append the following to `src/types/api.ts`:

```typescript
// Feed subscriptions (Phase 5)
export const feedSubscriptionCreate = z.object({
	name: z.string().min(1).max(200),
	feedUrl: z.string().url(),
	feedType: z.enum(['rss', 'atom', 'news']).default('rss'),
	schedule: z.string().default('0 */6 * * *'),
	keywords: z.string().optional(),
	maxItems: z.number().int().min(1).max(500).default(50),
})

export type FeedSubscriptionCreate = z.infer<typeof feedSubscriptionCreate>

export const feedSubscriptionUpdate = feedSubscriptionCreate.partial().extend({
	active: z.boolean().optional(),
})

export type FeedSubscriptionUpdate = z.infer<typeof feedSubscriptionUpdate>

// Scrape job dispatch (Phase 5)
export const scrapeJobDispatch = z.object({
	jobType: z.enum(['web_crawl', 'social_scrape', 'feed_ingest']),
	seedUrls: z.array(z.string().url()).optional(),
	subreddits: z.array(z.string()).optional(),
	keywords: z.array(z.string()).optional(),
	maxPages: z.number().int().min(1).max(1000).default(100),
	feedSubscriptionId: z.string().uuid().optional(),
})

export type ScrapeJobDispatch = z.infer<typeof scrapeJobDispatch>

export const scrapeJobCancel = z.object({
	jobId: z.string().uuid(),
})

export type ScrapeJobCancel = z.infer<typeof scrapeJobCancel>
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/types/scraper-api.test.ts`
Expected: PASS (9 tests)

**Step 5: Commit**

```bash
git add src/types/api.ts tests/types/scraper-api.test.ts
git commit -m "feat(phase5): add Zod schemas for feed subscriptions and scrape job dispatch"
```

---

### Task 3: Content Deduplication Service

**Files:**
- Create: `src/services/scraper/dedup.ts`
- Test: `tests/services/scraper/dedup.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/scraper/dedup.test.ts
import { describe, it, expect } from 'vitest'
import { hashContent, deduplicateArticles } from '../../../src/services/scraper/dedup'
import type { NormalizedArticle } from '../../../src/services/sentiment/ingestion'

describe('hashContent', () => {
	it('produces a consistent SHA-256 hex hash', () => {
		const hash1 = hashContent('hello world')
		const hash2 = hashContent('hello world')
		expect(hash1).toBe(hash2)
		expect(hash1).toHaveLength(64)
	})

	it('produces different hashes for different content', () => {
		expect(hashContent('a')).not.toBe(hashContent('b'))
	})
})

describe('deduplicateArticles', () => {
	const makeArticle = (title: string, hash: string): NormalizedArticle => ({
		tenantId: 't1',
		source: 'web',
		title,
		content: null,
		url: null,
		author: null,
		contentHash: hash,
		metadata: {},
		publishedAt: null,
	})

	it('removes duplicates within the batch by contentHash', () => {
		const articles = [
			makeArticle('First', 'hash-a'),
			makeArticle('Duplicate', 'hash-a'),
			makeArticle('Second', 'hash-b'),
		]
		const result = deduplicateArticles(articles)
		expect(result).toHaveLength(2)
		expect(result.map(a => a.title)).toEqual(['First', 'Second'])
	})

	it('removes articles whose hashes exist in the known set', () => {
		const articles = [
			makeArticle('New', 'hash-new'),
			makeArticle('Existing', 'hash-existing'),
		]
		const existingHashes = new Set(['hash-existing'])
		const result = deduplicateArticles(articles, existingHashes)
		expect(result).toHaveLength(1)
		expect(result[0].title).toBe('New')
	})

	it('returns empty for all duplicates', () => {
		const articles = [
			makeArticle('A', 'hash-x'),
			makeArticle('B', 'hash-x'),
		]
		const existingHashes = new Set(['hash-x'])
		expect(deduplicateArticles(articles, existingHashes)).toHaveLength(0)
	})

	it('preserves order (keeps first occurrence)', () => {
		const articles = [
			makeArticle('Z', 'hash-1'),
			makeArticle('A', 'hash-2'),
			makeArticle('M', 'hash-3'),
		]
		const result = deduplicateArticles(articles)
		expect(result.map(a => a.title)).toEqual(['Z', 'A', 'M'])
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/scraper/dedup.test.ts`
Expected: FAIL — module not found

**Step 3: Implement dedup.ts**

```typescript
// src/services/scraper/dedup.ts
import { createHash } from 'crypto'
import type { NormalizedArticle } from '../sentiment/ingestion'

/** Produce a SHA-256 hex hash for deduplication. */
export function hashContent(content: string): string {
	return createHash('sha256').update(content).digest('hex')
}

/** Remove duplicates within the batch and against a set of known hashes. */
export function deduplicateArticles(
	articles: NormalizedArticle[],
	existingHashes?: Set<string>,
): NormalizedArticle[] {
	const seen = new Set(existingHashes ?? [])
	const unique: NormalizedArticle[] = []

	for (const article of articles) {
		if (seen.has(article.contentHash)) continue
		seen.add(article.contentHash)
		unique.push(article)
	}

	return unique
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/scraper/dedup.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/services/scraper/dedup.ts tests/services/scraper/dedup.test.ts
git commit -m "feat(phase5): add content deduplication service with SHA-256 hashing"
```

---

### Task 4: Batch Handler — Persist Ingested Content

**Files:**
- Create: `src/services/scraper/batch-handler.ts`
- Test: `tests/services/scraper/batch-handler.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/scraper/batch-handler.test.ts
import { describe, it, expect, vi } from 'vitest'
import { processBatch, type BatchPayload } from '../../../src/services/scraper/batch-handler'

const mockDb = {
	select: vi.fn().mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([]),
		}),
	}),
	insert: vi.fn().mockReturnValue({
		values: vi.fn().mockReturnValue({
			onConflictDoNothing: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 'new-1' }]),
			}),
		}),
	}),
	update: vi.fn().mockReturnValue({
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	}),
}

vi.mock('../../../src/db/client', () => ({
	getDb: () => mockDb,
}))

describe('processBatch', () => {
	const webBatch: BatchPayload = {
		job_id: 'job-1',
		batch_index: 0,
		is_final: false,
		pages: [
			{ url: 'https://example.com/1', title: 'Article 1', content: 'Content 1' },
			{ url: 'https://example.com/2', title: 'Article 2', content: 'Content 2' },
		],
	}

	const socialBatch: BatchPayload = {
		job_id: 'job-2',
		batch_index: 0,
		is_final: true,
		posts: [
			{
				platform: 'reddit',
				title: 'Reddit Post',
				content: 'Post content',
				author: 'user1',
				url: 'https://reddit.com/r/test/123',
				engagement: { upvotes: 42 },
				posted_at: '2026-02-20T00:00:00Z',
			},
		],
	}

	it('processes web pages and returns insert count', async () => {
		const result = await processBatch(webBatch, 'tenant-1')
		expect(result.processed).toBe(2)
		expect(result.deduplicated).toBe(0)
		expect(result.jobId).toBe('job-1')
	})

	it('processes social posts', async () => {
		const result = await processBatch(socialBatch, 'tenant-1')
		expect(result.processed).toBeGreaterThanOrEqual(1)
		expect(result.jobId).toBe('job-2')
	})

	it('returns zero for empty batch', async () => {
		const emptyBatch: BatchPayload = {
			job_id: 'job-3',
			batch_index: 0,
			is_final: true,
		}
		const result = await processBatch(emptyBatch, 'tenant-1')
		expect(result.processed).toBe(0)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/scraper/batch-handler.test.ts`
Expected: FAIL — module not found

**Step 3: Implement batch-handler.ts**

```typescript
// src/services/scraper/batch-handler.ts
import { eq, inArray } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { scrapedArticles, scrapedSocial, scrapeJobs } from '../../db/schema'
import { normalizeBatchToArticles } from '../sentiment/ingestion'
import { deduplicateArticles } from './dedup'

export interface BatchPayload {
	job_id: string
	batch_index: number
	is_final: boolean
	pages?: Array<{
		url: string
		title: string
		content?: string
		author?: string
		content_hash?: string
	}>
	posts?: Array<{
		platform: string
		title?: string
		content?: string
		author?: string
		url?: string
		engagement?: Record<string, unknown>
		posted_at?: string
	}>
}

export interface BatchResult {
	jobId: string
	batchIndex: number
	processed: number
	deduplicated: number
	isFinal: boolean
}

/** Process a batch from the Rust scraper: normalize, deduplicate, persist. */
export async function processBatch(
	batch: BatchPayload,
	tenantId: string,
): Promise<BatchResult> {
	const db = getDb()
	const normalized = normalizeBatchToArticles(batch, tenantId)

	if (normalized.length === 0) {
		return { jobId: batch.job_id, batchIndex: batch.batch_index, processed: 0, deduplicated: 0, isFinal: batch.is_final }
	}

	// Fetch existing hashes for dedup
	const hashes = normalized.map(a => a.contentHash)
	const existingArticles = await db
		.select({ contentHash: scrapedArticles.contentHash })
		.from(scrapedArticles)
		.where(inArray(scrapedArticles.contentHash, hashes))
	const existingSocial = await db
		.select({ contentHash: scrapedSocial.contentHash })
		.from(scrapedSocial)
		.where(inArray(scrapedSocial.contentHash, hashes))

	const existingHashes = new Set([
		...existingArticles.map(a => a.contentHash),
		...existingSocial.map(s => s.contentHash),
	])

	const unique = deduplicateArticles(normalized, existingHashes)
	const deduplicated = normalized.length - unique.length

	// Split by type and insert
	const webArticles = unique.filter(a => ['web', 'rss', 'news'].includes(a.source))
	const socialPosts = unique.filter(a => ['reddit', 'linkedin', 'instagram'].includes(a.source))

	if (webArticles.length > 0) {
		await db.insert(scrapedArticles).values(
			webArticles.map(a => ({
				tenantId: a.tenantId,
				source: a.source as 'rss' | 'news' | 'web',
				title: a.title,
				content: a.content,
				url: a.url ?? '',
				author: a.author,
				contentHash: a.contentHash,
				metadata: a.metadata,
				publishedAt: a.publishedAt,
			})),
		)
	}

	if (socialPosts.length > 0) {
		await db.insert(scrapedSocial).values(
			socialPosts.map(a => ({
				tenantId: a.tenantId,
				platform: a.source as 'reddit' | 'linkedin' | 'instagram',
				title: a.title,
				content: a.content,
				url: a.url,
				author: a.author,
				contentHash: a.contentHash,
				engagement: (a.metadata as Record<string, unknown>).engagement ?? {},
				metadata: a.metadata,
				postedAt: a.publishedAt,
			})),
		)
	}

	// Update job progress
	if (batch.is_final) {
		await db.update(scrapeJobs)
			.set({ status: 'completed', completedAt: new Date() })
			.where(eq(scrapeJobs.id, batch.job_id))
	}

	return {
		jobId: batch.job_id,
		batchIndex: batch.batch_index,
		processed: unique.length,
		deduplicated,
		isFinal: batch.is_final,
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/scraper/batch-handler.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/services/scraper/batch-handler.ts tests/services/scraper/batch-handler.test.ts
git commit -m "feat(phase5): add batch handler — persist ingested content with dedup"
```

---

### Task 5: Job Tracker Service

**Files:**
- Create: `src/services/scraper/job-tracker.ts`
- Test: `tests/services/scraper/job-tracker.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/scraper/job-tracker.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createJob, cancelJob, getJobStatus, type JobConfig } from '../../../src/services/scraper/job-tracker'

const mockDbRows: Record<string, unknown> = {}

const mockDb = {
	insert: vi.fn().mockReturnValue({
		values: vi.fn().mockReturnValue({
			returning: vi.fn().mockImplementation(() => {
				return Promise.resolve([{
					id: 'job-new',
					tenantId: 't1',
					jobType: 'web_crawl',
					status: 'pending',
					config: {},
					callbackUrl: 'https://example.com/callback',
					pagesScraped: 0,
					createdAt: new Date(),
				}])
			}),
		}),
	}),
	select: vi.fn().mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([{
				id: 'job-1',
				tenantId: 't1',
				jobType: 'web_crawl',
				status: 'running',
				pagesScraped: 10,
			}]),
		}),
	}),
	update: vi.fn().mockReturnValue({
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{
					id: 'job-1',
					status: 'cancelled',
				}]),
			}),
		}),
	}),
}

vi.mock('../../../src/db/client', () => ({
	getDb: () => mockDb,
}))

describe('job tracker', () => {
	it('creates a new scrape job record', async () => {
		const config: JobConfig = {
			jobType: 'web_crawl',
			seedUrls: ['https://example.com'],
		}
		const job = await createJob('t1', config, 'https://example.com/callback')
		expect(job.id).toBe('job-new')
		expect(job.status).toBe('pending')
	})

	it('gets job status', async () => {
		const job = await getJobStatus('job-1', 't1')
		expect(job?.status).toBe('running')
		expect(job?.pagesScraped).toBe(10)
	})

	it('cancels a running job', async () => {
		const result = await cancelJob('job-1', 't1')
		expect(result?.status).toBe('cancelled')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/scraper/job-tracker.test.ts`
Expected: FAIL — module not found

**Step 3: Implement job-tracker.ts**

```typescript
// src/services/scraper/job-tracker.ts
import { eq, and } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { scrapeJobs } from '../../db/schema'

export interface JobConfig {
	jobType: 'web_crawl' | 'social_scrape' | 'feed_ingest'
	seedUrls?: string[]
	subreddits?: string[]
	keywords?: string[]
	maxPages?: number
	feedSubscriptionId?: string
}

export async function createJob(tenantId: string, config: JobConfig, callbackUrl: string) {
	const db = getDb()
	const [job] = await db.insert(scrapeJobs).values({
		tenantId,
		jobType: config.jobType,
		config,
		callbackUrl,
	}).returning()

	return job
}

export async function getJobStatus(jobId: string, tenantId: string) {
	const db = getDb()
	const [job] = await db
		.select()
		.from(scrapeJobs)
		.where(and(eq(scrapeJobs.id, jobId), eq(scrapeJobs.tenantId, tenantId)))

	return job ?? null
}

export async function cancelJob(jobId: string, tenantId: string) {
	const db = getDb()
	const [updated] = await db
		.update(scrapeJobs)
		.set({ status: 'cancelled' })
		.where(and(eq(scrapeJobs.id, jobId), eq(scrapeJobs.tenantId, tenantId)))
		.returning()

	return updated ?? null
}

export async function updateJobProgress(jobId: string, pagesScraped: number) {
	const db = getDb()
	await db
		.update(scrapeJobs)
		.set({ pagesScraped, status: 'running', startedAt: new Date() })
		.where(eq(scrapeJobs.id, jobId))
}

export async function completeJob(jobId: string, pagesScraped: number) {
	const db = getDb()
	await db
		.update(scrapeJobs)
		.set({ status: 'completed', pagesScraped, completedAt: new Date() })
		.where(eq(scrapeJobs.id, jobId))
}

export async function failJob(jobId: string, errorMessage: string) {
	const db = getDb()
	await db
		.update(scrapeJobs)
		.set({ status: 'failed', errorMessage, completedAt: new Date() })
		.where(eq(scrapeJobs.id, jobId))
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/scraper/job-tracker.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/services/scraper/job-tracker.ts tests/services/scraper/job-tracker.test.ts
git commit -m "feat(phase5): add job tracker — scrape job lifecycle management"
```

---

### Task 6: Feed Manager Service

**Files:**
- Create: `src/services/scraper/feed-manager.ts`
- Test: `tests/services/scraper/feed-manager.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/scraper/feed-manager.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
	isDue,
	parseCronSchedule,
	type FeedSubscription,
} from '../../../src/services/scraper/feed-manager'

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
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/scraper/feed-manager.test.ts`
Expected: FAIL — module not found

**Step 3: Implement feed-manager.ts**

```typescript
// src/services/scraper/feed-manager.ts
import { eq, and } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { feedSubscriptions } from '../../db/schema'

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

/** Increment error count on a feed subscription. */
export async function recordFeedError(feedId: string, error: string) {
	const db = getDb()
	const [feed] = await db
		.select()
		.from(feedSubscriptions)
		.where(eq(feedSubscriptions.id, feedId))

	if (!feed) return

	const newCount = feed.errorCount + 1
	const deactivate = newCount >= 5

	await db
		.update(feedSubscriptions)
		.set({
			errorCount: newCount,
			lastError: error,
			active: deactivate ? false : feed.active,
			updatedAt: new Date(),
		})
		.where(eq(feedSubscriptions.id, feedId))
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/scraper/feed-manager.test.ts`
Expected: PASS (7 tests)

**Step 5: Commit**

```bash
git add src/services/scraper/feed-manager.ts tests/services/scraper/feed-manager.test.ts
git commit -m "feat(phase5): add feed manager — schedule parsing, due checks, error tracking"
```

---

### Task 7: Post-Ingestion Sentiment Enrichment

**Files:**
- Create: `src/services/scraper/enrichment.ts`
- Test: `tests/services/scraper/enrichment.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/scraper/enrichment.test.ts
import { describe, it, expect, vi } from 'vitest'
import { enrichArticles } from '../../../src/services/scraper/enrichment'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn().mockResolvedValue({ score: 0.7, themes: ['positive', 'innovation'] }),
		generateContent: vi.fn(),
	}
}

describe('enrichArticles', () => {
	it('runs sentiment analysis on articles with content', async () => {
		const adapter = mockAdapter()
		const articles = [
			{
				id: 'a1',
				title: 'Great product launch',
				content: 'The new product exceeded expectations.',
				brand: 'AcmeCorp',
			},
			{
				id: 'a2',
				title: 'No content article',
				content: null,
				brand: 'AcmeCorp',
			},
		]

		const results = await enrichArticles(adapter, articles)
		expect(results).toHaveLength(1)
		expect(results[0].articleId).toBe('a1')
		expect(results[0].sentiment.score).toBe(0.7)
		expect(results[0].sentiment.themes).toContain('innovation')
	})

	it('returns empty for articles without content', async () => {
		const adapter = mockAdapter()
		const articles = [
			{ id: 'a1', title: 'No body', content: null, brand: 'Test' },
		]
		const results = await enrichArticles(adapter, articles)
		expect(results).toHaveLength(0)
	})

	it('skips articles where sentiment analysis fails', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockRejectedValue(new Error('LLM error')),
			generateContent: vi.fn(),
		}
		const articles = [
			{ id: 'a1', title: 'Test', content: 'Content here', brand: 'Brand' },
		]
		const results = await enrichArticles(adapter, articles)
		expect(results).toHaveLength(0)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/scraper/enrichment.test.ts`
Expected: FAIL — module not found

**Step 3: Implement enrichment.ts**

```typescript
// src/services/scraper/enrichment.ts
import type { OpenAIAdapter } from '../../adapters/openai'

export interface ArticleForEnrichment {
	id: string
	title: string
	content: string | null
	brand: string
}

export interface EnrichmentResult {
	articleId: string
	sentiment: { score: number; themes: string[] }
}

/** Run sentiment analysis on articles that have content. */
export async function enrichArticles(
	adapter: OpenAIAdapter,
	articles: ArticleForEnrichment[],
): Promise<EnrichmentResult[]> {
	const withContent = articles.filter(a => a.content !== null && a.content.length > 0)
	const results: EnrichmentResult[] = []

	for (const article of withContent) {
		try {
			const sentiment = await adapter.analyzeSentiment(article.content!, article.brand)
			results.push({ articleId: article.id, sentiment })
		} catch {
			// Skip articles where analysis fails
		}
	}

	return results
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/scraper/enrichment.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/services/scraper/enrichment.ts tests/services/scraper/enrichment.test.ts
git commit -m "feat(phase5): add post-ingestion sentiment enrichment service"
```

---

### Task 8: Complete the Ingest Route — Wire Up Batch Persistence

**Files:**
- Modify: `src/routes/ingest.ts`
- Modify: `tests/services/scraper.test.ts` (extend, or create new)
- Test: `tests/routes/ingest.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/ingest.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createIngestRoutes } from '../../src/routes/ingest'

vi.mock('../../src/services/scraper/batch-handler', () => ({
	processBatch: vi.fn().mockResolvedValue({
		jobId: 'job-1',
		batchIndex: 0,
		processed: 3,
		deduplicated: 1,
		isFinal: false,
	}),
}))

vi.mock('../../src/services/scraper/dispatcher', () => ({
	verifySignature: vi.fn().mockReturnValue(true),
}))

describe('ingest routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.route('/ingest', createIngestRoutes())
	})

	it('POST /batch persists content and returns result', async () => {
		const batch = {
			job_id: 'job-1',
			batch_index: 0,
			is_final: false,
			tenant_id: 'tenant-1',
			pages: [
				{ url: 'https://example.com', title: 'Test', content: 'Content' },
			],
		}
		const body = JSON.stringify(batch)
		const timestamp = Math.floor(Date.now() / 1000).toString()

		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-signature': 'valid-sig',
				'x-timestamp': timestamp,
			},
			body,
		})
		expect(res.status).toBe(200)
		const result = await res.json()
		expect(result.processed).toBe(3)
		expect(result.deduplicated).toBe(1)
	})

	it('rejects requests without HMAC headers', async () => {
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ job_id: '1', batch_index: 0, is_final: true }),
		})
		expect(res.status).toBe(401)
	})

	it('rejects expired timestamps', async () => {
		const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString()
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-signature': 'sig',
				'x-timestamp': oldTimestamp,
			},
			body: JSON.stringify({ job_id: '1', batch_index: 0, is_final: true }),
		})
		expect(res.status).toBe(401)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/ingest.test.ts`
Expected: FAIL — processBatch not called by current stub

**Step 3: Update ingest.ts to wire up batch persistence**

Replace `src/routes/ingest.ts`:

```typescript
// src/routes/ingest.ts
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { verifySignature } from '../services/scraper/dispatcher'
import { processBatch, type BatchPayload } from '../services/scraper/batch-handler'

export function createIngestRoutes() {
	const router = new Hono<AppEnv>()

	router.post('/batch', async (c) => {
		const secret = process.env.SCRAPER_SHARED_SECRET || 'dev-secret'
		const signature = c.req.header('x-signature')
		const timestamp = c.req.header('x-timestamp')
		const body = await c.req.text()

		if (!signature || !timestamp) {
			return c.json({ error: 'Missing HMAC headers' }, 401)
		}

		const now = Math.floor(Date.now() / 1000)
		if (Math.abs(now - parseInt(timestamp)) > 300) {
			return c.json({ error: 'Timestamp too old' }, 401)
		}

		if (!verifySignature(body, timestamp, signature, secret)) {
			return c.json({ error: 'Invalid signature' }, 401)
		}

		const payload = JSON.parse(body) as BatchPayload & { tenant_id?: string }
		const tenantId = payload.tenant_id ?? c.get('tenantId') ?? ''

		const result = await processBatch(payload, tenantId)

		return c.json(result)
	})

	return router
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/routes/ingest.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/routes/ingest.ts tests/routes/ingest.test.ts
git commit -m "feat(phase5): wire ingest route to batch handler — persist with dedup"
```

---

### Task 9: Scraper Management Routes (Job Dispatch + Status)

**Files:**
- Create: `src/routes/scraper.ts`
- Modify: `src/routes/index.ts` (register new route)
- Test: `tests/routes/scraper.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/scraper.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createScraperRoutes } from '../../src/routes/scraper'

vi.mock('../../src/services/scraper/job-tracker', () => ({
	createJob: vi.fn().mockResolvedValue({
		id: 'job-new',
		tenantId: 't1',
		jobType: 'web_crawl',
		status: 'pending',
		createdAt: new Date(),
	}),
	getJobStatus: vi.fn().mockResolvedValue({
		id: 'job-1',
		tenantId: 't1',
		jobType: 'web_crawl',
		status: 'running',
		pagesScraped: 42,
	}),
	cancelJob: vi.fn().mockResolvedValue({
		id: 'job-1',
		status: 'cancelled',
	}),
}))

vi.mock('../../src/services/scraper/dispatcher', () => ({
	dispatchScrapeJob: vi.fn().mockResolvedValue({ status: 'queued' }),
	signPayload: vi.fn(),
	verifySignature: vi.fn(),
}))

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([]),
				}),
			}),
		}),
	}),
}))

describe('scraper routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('tenantId', 't1')
			c.set('userId', 'u1')
			await next()
		})
		app.route('/scraper', createScraperRoutes())
	})

	it('POST /jobs dispatches a scrape job', async () => {
		const res = await app.request('/scraper/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jobType: 'web_crawl',
				seedUrls: ['https://example.com'],
			}),
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.id).toBe('job-new')
	})

	it('GET /jobs/:id returns job status', async () => {
		const res = await app.request('/scraper/jobs/job-1')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.status).toBe('running')
		expect(body.pagesScraped).toBe(42)
	})

	it('POST /jobs/:id/cancel cancels a job', async () => {
		const res = await app.request('/scraper/jobs/job-1/cancel', {
			method: 'POST',
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.status).toBe('cancelled')
	})

	it('GET /jobs lists jobs', async () => {
		const res = await app.request('/scraper/jobs')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toBeDefined()
	})

	it('POST /jobs rejects invalid jobType', async () => {
		const res = await app.request('/scraper/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jobType: 'invalid' }),
		})
		expect(res.status).toBe(422)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/scraper.test.ts`
Expected: FAIL — module not found

**Step 3: Implement scraper routes**

```typescript
// src/routes/scraper.ts
import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { scrapeJobs } from '../db/schema'
import { getDb } from '../db/client'
import { scrapeJobDispatch } from '../types/api'
import { NotFoundError } from '../types/errors'
import { createJob, getJobStatus, cancelJob } from '../services/scraper/job-tracker'
import { dispatchScrapeJob } from '../services/scraper/dispatcher'
import { getConfig } from '../config'

export function createScraperRoutes() {
	const router = new Hono<AppEnv>()

	// List scrape jobs
	router.get('/jobs', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(scrapeJobs)
			.where(eq(scrapeJobs.tenantId, tenantId))
			.orderBy(desc(scrapeJobs.createdAt))

		return c.json({ items })
	})

	// Dispatch a new scrape job
	router.post('/jobs', validate('json', scrapeJobDispatch), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const config = getConfig()

		const callbackUrl = `${config.BETTER_AUTH_URL}/api/v1/ingest/batch`

		const job = await createJob(tenantId, {
			jobType: data.jobType,
			seedUrls: data.seedUrls,
			subreddits: data.subreddits,
			keywords: data.keywords,
			maxPages: data.maxPages,
			feedSubscriptionId: data.feedSubscriptionId,
		}, callbackUrl)

		// Dispatch to Rust worker (fire-and-forget)
		dispatchScrapeJob({
			jobId: job.id,
			callbackUrl,
			config: {
				jobType: data.jobType,
				seedUrls: data.seedUrls,
				subreddits: data.subreddits,
				keywords: data.keywords,
				maxPages: data.maxPages,
			},
		}).catch(err => console.error('Failed to dispatch scrape job', { jobId: job.id, error: err }))

		return c.json(job, 201)
	})

	// Get job status
	router.get('/jobs/:id', async (c) => {
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const job = await getJobStatus(id, tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', id)

		return c.json(job)
	})

	// Cancel a job
	router.post('/jobs/:id/cancel', async (c) => {
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const job = await cancelJob(id, tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', id)

		return c.json(job)
	})

	return router
}
```

**Step 4: Register in routes/index.ts**

Add to `src/routes/index.ts`:

```typescript
import { createScraperRoutes } from './scraper'
// ... in registerRoutes():
app.route('/api/v1/scraper', createScraperRoutes())
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/routes/scraper.test.ts`
Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add src/routes/scraper.ts src/routes/index.ts tests/routes/scraper.test.ts
git commit -m "feat(phase5): add scraper management routes — dispatch, status, cancel"
```

---

### Task 10: Feed Subscription Routes

**Files:**
- Create: `src/routes/feeds.ts`
- Modify: `src/routes/index.ts` (register new route)
- Test: `tests/routes/feeds.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/feeds.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createFeedRoutes } from '../../src/routes/feeds'

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([
						{
							id: 'feed-1',
							tenantId: 't1',
							name: 'TechCrunch',
							feedUrl: 'https://techcrunch.com/feed/',
							feedType: 'rss',
							active: true,
							schedule: '0 */6 * * *',
						},
					]),
				}),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{
					id: 'feed-new',
					tenantId: 't1',
					name: 'Hacker News',
					feedUrl: 'https://hn.algolia.com/api/v1/search',
					feedType: 'news',
					active: true,
				}]),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{
						id: 'feed-1',
						active: false,
					}]),
				}),
			}),
		}),
		delete: vi.fn().mockReturnValue({
			where: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 'feed-1' }]),
			}),
		}),
	}),
}))

describe('feed routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('tenantId', 't1')
			c.set('userId', 'u1')
			await next()
		})
		app.route('/feeds', createFeedRoutes())
	})

	it('GET / lists feed subscriptions', async () => {
		const res = await app.request('/feeds')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
		expect(body.items[0].name).toBe('TechCrunch')
	})

	it('POST / creates a feed subscription', async () => {
		const res = await app.request('/feeds', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Hacker News',
				feedUrl: 'https://hn.algolia.com/api/v1/search',
				feedType: 'news',
			}),
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.id).toBe('feed-new')
	})

	it('PATCH /:id updates a feed subscription', async () => {
		const res = await app.request('/feeds/feed-1', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ active: false }),
		})
		expect(res.status).toBe(200)
	})

	it('DELETE /:id deletes a feed subscription', async () => {
		const res = await app.request('/feeds/feed-1', {
			method: 'DELETE',
		})
		expect(res.status).toBe(200)
	})

	it('POST / rejects invalid feedUrl', async () => {
		const res = await app.request('/feeds', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Test', feedUrl: 'not-a-url' }),
		})
		expect(res.status).toBe(422)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/feeds.test.ts`
Expected: FAIL — module not found

**Step 3: Implement feed routes**

```typescript
// src/routes/feeds.ts
import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { feedSubscriptions } from '../db/schema'
import { getDb } from '../db/client'
import { feedSubscriptionCreate, feedSubscriptionUpdate } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createFeedRoutes() {
	const router = new Hono<AppEnv>()

	// List feed subscriptions
	router.get('/', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(feedSubscriptions)
			.where(eq(feedSubscriptions.tenantId, tenantId))
			.orderBy(desc(feedSubscriptions.createdAt))

		return c.json({ items })
	})

	// Create feed subscription
	router.post('/', validate('json', feedSubscriptionCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(feedSubscriptions).values({
			tenantId,
			name: data.name,
			feedUrl: data.feedUrl,
			feedType: data.feedType,
			schedule: data.schedule,
			keywords: data.keywords,
			maxItems: data.maxItems,
		}).returning()

		return c.json(created, 201)
	})

	// Update feed subscription
	router.patch('/:id', validate('json', feedSubscriptionUpdate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const data = c.req.valid('json')

		const [updated] = await db
			.update(feedSubscriptions)
			.set({ ...data, updatedAt: new Date() })
			.where(and(eq(feedSubscriptions.id, id), eq(feedSubscriptions.tenantId, tenantId)))
			.returning()

		if (!updated) throw new NotFoundError('FeedSubscription', id)

		return c.json(updated)
	})

	// Delete feed subscription
	router.delete('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [deleted] = await db
			.delete(feedSubscriptions)
			.where(and(eq(feedSubscriptions.id, id), eq(feedSubscriptions.tenantId, tenantId)))
			.returning()

		if (!deleted) throw new NotFoundError('FeedSubscription', id)

		return c.json({ deleted: true, id: deleted.id })
	})

	return router
}
```

**Step 4: Register in routes/index.ts**

Add to `src/routes/index.ts`:

```typescript
import { createFeedRoutes } from './feeds'
// ... in registerRoutes():
app.route('/api/v1/feeds', createFeedRoutes())
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/routes/feeds.test.ts`
Expected: PASS (5 tests)

**Step 6: Commit**

```bash
git add src/routes/feeds.ts src/routes/index.ts tests/routes/feeds.test.ts
git commit -m "feat(phase5): add feed subscription CRUD routes"
```

---

### Task 11: Integration Test — Full Scraper Pipeline

**Files:**
- Create: `tests/integration/phase5.test.ts`

**Step 1: Write the integration test**

```typescript
// tests/integration/phase5.test.ts
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
				{ url: 'https://techcrunch.com/article2', title: 'Duplicate of first', content: 'AcmeCorp launched their new AI product today.', content_hash: undefined },
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
```

**Step 2: Run test to verify it passes**

Run: `bunx vitest run tests/integration/phase5.test.ts`
Expected: PASS (3 tests)

**Step 3: Commit**

```bash
git add tests/integration/phase5.test.ts
git commit -m "test(phase5): add integration test — full scraper pipeline"
```

---

### Task 12: Run Full Test Suite

**Step 1: Run all tests**

Run: `bunx vitest run`
Expected: ALL PASS — no regressions from Phase 1/2/3/4 tests

**Step 2: Run linter**

Run: `bunx biome check src/ tests/`
Expected: No errors

**Step 3: Fix any issues found**

If there are failures, fix them and re-run.

**Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix(phase5): resolve lint/test issues from full suite run"
```

---

## Summary

| Task | Component | New Files | Tests |
|------|-----------|-----------|-------|
| 1 | Feed subscriptions schema | 1 | 1 |
| 2 | Zod API schemas | 0 (modify) | 9 |
| 3 | Content dedup service | 1 | 6 |
| 4 | Batch handler (persist) | 1 | 3 |
| 5 | Job tracker service | 1 | 3 |
| 6 | Feed manager service | 1 | 7 |
| 7 | Enrichment service | 1 | 3 |
| 8 | Ingest route (wire up) | 0 (modify) | 3 |
| 9 | Scraper management routes | 1 | 5 |
| 10 | Feed subscription routes | 1 | 5 |
| 11 | Integration test | 1 | 3 |
| 12 | Full suite validation | 0 | — |

**Total: ~9 new files, ~48 tests, 12 commits**
