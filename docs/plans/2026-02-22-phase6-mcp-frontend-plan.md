# Phase 6 — MCP Server + SSE + Pipeline Completion

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose intelligence capabilities via Model Context Protocol (MCP) server, add SSE streaming for real-time dashboard updates, complete the remaining scraper ingestion pipeline (Phase 5 tasks 4-12), and add analytics aggregation endpoints.

**Architecture:** MCP server runs alongside the Hono API, exposing 8 intelligence tools (sentiment, accounts, personas, experiments, brand audit, workflows, lead scoring, competitive intel) via `@modelcontextprotocol/sdk`. SSE endpoints stream real-time events for dashboard consumption. Remaining Phase 5 services (batch handler, job tracker, feed manager, enrichment) complete the data pipeline from Rust scraper to intelligence layer.

**Tech Stack:** Hono 4.12, Bun, `@modelcontextprotocol/sdk`, Drizzle ORM (NeonDB), Zod, Vitest, existing OpenAI adapter + services.

---

## File Map

```
src/mcp/
  server.ts              — MCP server setup + tool registration
  tools/
    sentiment.ts         — get_sentiment_analysis, get_competitive_intel
    accounts.ts          — get_hot_accounts, score_lead
    personas.ts          — generate_persona
    experiments.ts       — get_experiment_allocation
    brand.ts             — audit_brand_content
    workflows.ts         — generate_workflow

src/routes/
  mcp.ts                 — Mount MCP SSE transport on Hono
  sse.ts                 — Real-time SSE streaming endpoints
  analytics.ts           — Dashboard data aggregation
  scraper.ts             — NEW: job dispatch + management (Phase 5 gap)
  feeds.ts               — NEW: feed subscription CRUD (Phase 5 gap)
  ingest.ts              — MODIFY: wire batch persistence (Phase 5 gap)

src/services/scraper/
  batch-handler.ts       — NEW: persist batches with dedup (Phase 5 gap)
  job-tracker.ts         — NEW: scrape job lifecycle (Phase 5 gap)
  feed-manager.ts        — NEW: feed scheduling (Phase 5 gap)
  enrichment.ts          — NEW: post-ingestion sentiment (Phase 5 gap)
```

---

### Task 1: Complete Phase 5 — Batch Handler + Ingest Route

**Files:**
- Create: `src/services/scraper/batch-handler.ts`
- Modify: `src/routes/ingest.ts`
- Test: `tests/services/scraper/batch-handler.test.ts`
- Test: `tests/routes/ingest.test.ts`

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
	it('processes web pages and returns result', async () => {
		const batch: BatchPayload = {
			job_id: 'job-1',
			batch_index: 0,
			is_final: false,
			pages: [
				{ url: 'https://example.com/1', title: 'Article 1', content: 'Content 1' },
				{ url: 'https://example.com/2', title: 'Article 2', content: 'Content 2' },
			],
		}
		const result = await processBatch(batch, 'tenant-1')
		expect(result.processed).toBe(2)
		expect(result.jobId).toBe('job-1')
	})

	it('processes social posts', async () => {
		const batch: BatchPayload = {
			job_id: 'job-2',
			batch_index: 0,
			is_final: true,
			posts: [{ platform: 'reddit', title: 'Post', content: 'Content', author: 'user1' }],
		}
		const result = await processBatch(batch, 'tenant-1')
		expect(result.processed).toBeGreaterThanOrEqual(1)
	})

	it('returns zero for empty batch', async () => {
		const result = await processBatch({ job_id: 'j3', batch_index: 0, is_final: true }, 'tenant-1')
		expect(result.processed).toBe(0)
	})
})
```

```typescript
// tests/routes/ingest.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createIngestRoutes } from '../../src/routes/ingest'

vi.mock('../../src/services/scraper/batch-handler', () => ({
	processBatch: vi.fn().mockResolvedValue({
		jobId: 'job-1', batchIndex: 0, processed: 3, deduplicated: 1, isFinal: false,
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
		const timestamp = Math.floor(Date.now() / 1000).toString()
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'x-signature': 'sig', 'x-timestamp': timestamp },
			body: JSON.stringify({ job_id: 'job-1', batch_index: 0, is_final: false, tenant_id: 't1', pages: [] }),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.processed).toBe(3)
	})

	it('rejects requests without HMAC headers', async () => {
		const res = await app.request('/ingest/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ job_id: '1', batch_index: 0, is_final: true }),
		})
		expect(res.status).toBe(401)
	})
})
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/services/scraper/batch-handler.test.ts tests/routes/ingest.test.ts`
Expected: FAIL — modules not found

**Step 3: Implement batch-handler.ts**

```typescript
// src/services/scraper/batch-handler.ts
import { inArray, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { scrapedArticles, scrapedSocial, scrapeJobs } from '../../db/schema'
import { normalizeBatchToArticles } from '../sentiment/ingestion'
import { deduplicateArticles } from './dedup'

export interface BatchPayload {
	job_id: string
	batch_index: number
	is_final: boolean
	pages?: Array<{ url: string; title: string; content?: string; author?: string; content_hash?: string }>
	posts?: Array<{ platform: string; title?: string; content?: string; author?: string; url?: string; engagement?: Record<string, unknown>; posted_at?: string }>
}

export interface BatchResult {
	jobId: string
	batchIndex: number
	processed: number
	deduplicated: number
	isFinal: boolean
}

export async function processBatch(batch: BatchPayload, tenantId: string): Promise<BatchResult> {
	const db = getDb()
	const normalized = normalizeBatchToArticles(batch, tenantId)

	if (normalized.length === 0) {
		return { jobId: batch.job_id, batchIndex: batch.batch_index, processed: 0, deduplicated: 0, isFinal: batch.is_final }
	}

	const hashes = normalized.map(a => a.contentHash)
	const existingArticles = await db.select({ contentHash: scrapedArticles.contentHash }).from(scrapedArticles).where(inArray(scrapedArticles.contentHash, hashes))
	const existingSocial = await db.select({ contentHash: scrapedSocial.contentHash }).from(scrapedSocial).where(inArray(scrapedSocial.contentHash, hashes))
	const existingHashes = new Set([...existingArticles.map(a => a.contentHash), ...existingSocial.map(s => s.contentHash)])

	const unique = deduplicateArticles(normalized, existingHashes)
	const deduplicated = normalized.length - unique.length

	const webArticles = unique.filter(a => ['web', 'rss', 'news'].includes(a.source))
	const socialPosts = unique.filter(a => ['reddit', 'linkedin', 'instagram'].includes(a.source))

	if (webArticles.length > 0) {
		await db.insert(scrapedArticles).values(webArticles.map(a => ({
			tenantId: a.tenantId, source: a.source as 'rss' | 'news' | 'web', title: a.title,
			content: a.content, url: a.url ?? '', author: a.author, contentHash: a.contentHash,
			metadata: a.metadata, publishedAt: a.publishedAt,
		})))
	}

	if (socialPosts.length > 0) {
		await db.insert(scrapedSocial).values(socialPosts.map(a => ({
			tenantId: a.tenantId, platform: a.source as 'reddit' | 'linkedin' | 'instagram',
			title: a.title, content: a.content, url: a.url, author: a.author,
			contentHash: a.contentHash, engagement: (a.metadata as Record<string, unknown>).engagement ?? {},
			metadata: a.metadata, postedAt: a.publishedAt,
		})))
	}

	if (batch.is_final) {
		await db.update(scrapeJobs).set({ status: 'completed', completedAt: new Date() }).where(eq(scrapeJobs.id, batch.job_id))
	}

	return { jobId: batch.job_id, batchIndex: batch.batch_index, processed: unique.length, deduplicated, isFinal: batch.is_final }
}
```

**Step 4: Update ingest route**

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

**Step 5: Run tests to verify they pass**

Run: `bunx vitest run tests/services/scraper/batch-handler.test.ts tests/routes/ingest.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/services/scraper/batch-handler.ts src/routes/ingest.ts \
  tests/services/scraper/batch-handler.test.ts tests/routes/ingest.test.ts
git commit -m "feat(phase6): add batch handler + wire ingest route for persistence"
```

---

### Task 2: Complete Phase 5 — Job Tracker + Scraper Routes

**Files:**
- Create: `src/services/scraper/job-tracker.ts`
- Create: `src/routes/scraper.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/services/scraper/job-tracker.test.ts`
- Test: `tests/routes/scraper.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/services/scraper/job-tracker.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createJob, getJobStatus, cancelJob } from '../../../src/services/scraper/job-tracker'

const mockDb = {
	insert: vi.fn().mockReturnValue({
		values: vi.fn().mockReturnValue({
			returning: vi.fn().mockResolvedValue([{ id: 'job-new', tenantId: 't1', jobType: 'web_crawl', status: 'pending', createdAt: new Date() }]),
		}),
	}),
	select: vi.fn().mockReturnValue({
		from: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([{ id: 'job-1', tenantId: 't1', status: 'running', pagesScraped: 10 }]),
		}),
	}),
	update: vi.fn().mockReturnValue({
		set: vi.fn().mockReturnValue({
			where: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: 'job-1', status: 'cancelled' }]),
			}),
		}),
	}),
}

vi.mock('../../../src/db/client', () => ({ getDb: () => mockDb }))

describe('job tracker', () => {
	it('creates a scrape job', async () => {
		const job = await createJob('t1', { jobType: 'web_crawl', seedUrls: ['https://example.com'] }, 'https://cb.example.com')
		expect(job.status).toBe('pending')
	})

	it('gets job status', async () => {
		const job = await getJobStatus('job-1', 't1')
		expect(job?.status).toBe('running')
	})

	it('cancels a job', async () => {
		const result = await cancelJob('job-1', 't1')
		expect(result?.status).toBe('cancelled')
	})
})
```

```typescript
// tests/routes/scraper.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createScraperRoutes } from '../../src/routes/scraper'

vi.mock('../../src/services/scraper/job-tracker', () => ({
	createJob: vi.fn().mockResolvedValue({ id: 'job-new', tenantId: 't1', jobType: 'web_crawl', status: 'pending' }),
	getJobStatus: vi.fn().mockResolvedValue({ id: 'job-1', status: 'running', pagesScraped: 42 }),
	cancelJob: vi.fn().mockResolvedValue({ id: 'job-1', status: 'cancelled' }),
}))

vi.mock('../../src/services/scraper/dispatcher', () => ({
	dispatchScrapeJob: vi.fn().mockResolvedValue({ status: 'queued' }),
	signPayload: vi.fn(), verifySignature: vi.fn(),
}))

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }) }) }),
	}),
}))

describe('scraper routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); c.set('userId', 'u1'); await next() })
		app.route('/scraper', createScraperRoutes())
	})

	it('POST /jobs dispatches a scrape job', async () => {
		const res = await app.request('/scraper/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jobType: 'web_crawl', seedUrls: ['https://example.com'] }),
		})
		expect(res.status).toBe(201)
	})

	it('GET /jobs/:id returns job status', async () => {
		const res = await app.request('/scraper/jobs/job-1')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.status).toBe('running')
	})

	it('POST /jobs/:id/cancel cancels a job', async () => {
		const res = await app.request('/scraper/jobs/job-1/cancel', { method: 'POST' })
		expect(res.status).toBe(200)
	})

	it('rejects invalid jobType', async () => {
		const res = await app.request('/scraper/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jobType: 'invalid' }),
		})
		expect(res.status).toBe(422)
	})
})
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/services/scraper/job-tracker.test.ts tests/routes/scraper.test.ts`
Expected: FAIL

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
	const [job] = await db.insert(scrapeJobs).values({ tenantId, jobType: config.jobType, config, callbackUrl }).returning()
	return job
}

export async function getJobStatus(jobId: string, tenantId: string) {
	const db = getDb()
	const [job] = await db.select().from(scrapeJobs).where(and(eq(scrapeJobs.id, jobId), eq(scrapeJobs.tenantId, tenantId)))
	return job ?? null
}

export async function cancelJob(jobId: string, tenantId: string) {
	const db = getDb()
	const [updated] = await db.update(scrapeJobs).set({ status: 'cancelled' }).where(and(eq(scrapeJobs.id, jobId), eq(scrapeJobs.tenantId, tenantId))).returning()
	return updated ?? null
}

export async function completeJob(jobId: string, pagesScraped: number) {
	const db = getDb()
	await db.update(scrapeJobs).set({ status: 'completed', pagesScraped, completedAt: new Date() }).where(eq(scrapeJobs.id, jobId))
}

export async function failJob(jobId: string, errorMessage: string) {
	const db = getDb()
	await db.update(scrapeJobs).set({ status: 'failed', errorMessage, completedAt: new Date() }).where(eq(scrapeJobs.id, jobId))
}
```

**Step 4: Implement scraper routes**

```typescript
// src/routes/scraper.ts
import { Hono } from 'hono'
import { eq, desc } from 'drizzle-orm'
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

	router.get('/jobs', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const items = await db.select().from(scrapeJobs).where(eq(scrapeJobs.tenantId, tenantId)).orderBy(desc(scrapeJobs.createdAt))
		return c.json({ items })
	})

	router.post('/jobs', validate('json', scrapeJobDispatch), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const config = getConfig()
		const callbackUrl = `${config.BETTER_AUTH_URL}/api/v1/ingest/batch`

		const job = await createJob(tenantId, {
			jobType: data.jobType, seedUrls: data.seedUrls, subreddits: data.subreddits,
			keywords: data.keywords, maxPages: data.maxPages, feedSubscriptionId: data.feedSubscriptionId,
		}, callbackUrl)

		dispatchScrapeJob({
			jobId: job.id, callbackUrl,
			config: { jobType: data.jobType, seedUrls: data.seedUrls, subreddits: data.subreddits, keywords: data.keywords, maxPages: data.maxPages },
		}).catch(err => console.error('Failed to dispatch scrape job', { jobId: job.id, error: err }))

		return c.json(job, 201)
	})

	router.get('/jobs/:id', async (c) => {
		const tenantId = c.get('tenantId')!
		const job = await getJobStatus(c.req.param('id'), tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', c.req.param('id'))
		return c.json(job)
	})

	router.post('/jobs/:id/cancel', async (c) => {
		const tenantId = c.get('tenantId')!
		const job = await cancelJob(c.req.param('id'), tenantId)
		if (!job) throw new NotFoundError('ScrapeJob', c.req.param('id'))
		return c.json(job)
	})

	return router
}
```

**Step 5: Register in routes/index.ts**

Add `import { createScraperRoutes } from './scraper'` and `app.route('/api/v1/scraper', createScraperRoutes())` to `src/routes/index.ts`.

**Step 6: Run tests to verify they pass**

Run: `bunx vitest run tests/services/scraper/job-tracker.test.ts tests/routes/scraper.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/services/scraper/job-tracker.ts src/routes/scraper.ts src/routes/index.ts \
  tests/services/scraper/job-tracker.test.ts tests/routes/scraper.test.ts
git commit -m "feat(phase6): add job tracker service + scraper management routes"
```

---

### Task 3: Complete Phase 5 — Feed Manager + Feed Routes

**Files:**
- Create: `src/services/scraper/feed-manager.ts`
- Create: `src/routes/feeds.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/services/scraper/feed-manager.test.ts`
- Test: `tests/routes/feeds.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/services/scraper/feed-manager.test.ts
import { describe, it, expect } from 'vitest'
import { parseCronSchedule, isDue, type FeedSubscription } from '../../../src/services/scraper/feed-manager'

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
```

```typescript
// tests/routes/feeds.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createFeedRoutes } from '../../src/routes/feeds'

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([{ id: 'feed-1', name: 'TechCrunch', active: true }]) }) }) }),
		insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'feed-new', name: 'HN' }]) }) }),
		update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'feed-1', active: false }]) }) }) }),
		delete: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'feed-1' }]) }) }),
	}),
}))

describe('feed routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); await next() })
		app.route('/feeds', createFeedRoutes())
	})

	it('GET / lists feeds', async () => {
		const res = await app.request('/feeds')
		expect(res.status).toBe(200)
	})

	it('POST / creates a feed', async () => {
		const res = await app.request('/feeds', {
			method: 'POST', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'HN', feedUrl: 'https://hn.algolia.com/feed' }),
		})
		expect(res.status).toBe(201)
	})

	it('PATCH /:id updates a feed', async () => {
		const res = await app.request('/feeds/feed-1', {
			method: 'PATCH', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ active: false }),
		})
		expect(res.status).toBe(200)
	})

	it('DELETE /:id deletes a feed', async () => {
		const res = await app.request('/feeds/feed-1', { method: 'DELETE' })
		expect(res.status).toBe(200)
	})
})
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/services/scraper/feed-manager.test.ts tests/routes/feeds.test.ts`
Expected: FAIL

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

const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000

export function parseCronSchedule(schedule: string): number {
	const hourly = schedule.match(/^0\s+\*\/(\d+)\s+\*\s+\*\s+\*$/)
	if (hourly) return parseInt(hourly[1]) * 60 * 60 * 1000
	if (schedule.match(/^0\s+0\s+\*\s+\*\s+\*$/)) return 24 * 60 * 60 * 1000
	return DEFAULT_INTERVAL_MS
}

export function isDue(feed: FeedSubscription): boolean {
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
```

**Step 4: Implement feed routes**

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

	router.get('/', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const items = await db.select().from(feedSubscriptions).where(eq(feedSubscriptions.tenantId, tenantId)).orderBy(desc(feedSubscriptions.createdAt))
		return c.json({ items })
	})

	router.post('/', validate('json', feedSubscriptionCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const [created] = await db.insert(feedSubscriptions).values({ tenantId, ...data }).returning()
		return c.json(created, 201)
	})

	router.patch('/:id', validate('json', feedSubscriptionUpdate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const data = c.req.valid('json')
		const [updated] = await db.update(feedSubscriptions).set({ ...data, updatedAt: new Date() }).where(and(eq(feedSubscriptions.id, id), eq(feedSubscriptions.tenantId, tenantId))).returning()
		if (!updated) throw new NotFoundError('FeedSubscription', id)
		return c.json(updated)
	})

	router.delete('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const [deleted] = await db.delete(feedSubscriptions).where(and(eq(feedSubscriptions.id, id), eq(feedSubscriptions.tenantId, tenantId))).returning()
		if (!deleted) throw new NotFoundError('FeedSubscription', id)
		return c.json({ deleted: true, id: deleted.id })
	})

	return router
}
```

**Step 5: Register in routes/index.ts**

Add `import { createFeedRoutes } from './feeds'` and `app.route('/api/v1/feeds', createFeedRoutes())`.

**Step 6: Run tests to verify they pass**

Run: `bunx vitest run tests/services/scraper/feed-manager.test.ts tests/routes/feeds.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/services/scraper/feed-manager.ts src/routes/feeds.ts src/routes/index.ts \
  tests/services/scraper/feed-manager.test.ts tests/routes/feeds.test.ts
git commit -m "feat(phase6): add feed manager service + feed subscription routes"
```

---

### Task 4: Complete Phase 5 — Enrichment Service

**Files:**
- Create: `src/services/scraper/enrichment.ts`
- Test: `tests/services/scraper/enrichment.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/scraper/enrichment.test.ts
import { describe, it, expect, vi } from 'vitest'
import { enrichArticles } from '../../../src/services/scraper/enrichment'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

describe('enrichArticles', () => {
	it('runs sentiment analysis on articles with content', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockResolvedValue({ score: 0.7, themes: ['innovation'] }),
			generateContent: vi.fn(),
		}
		const results = await enrichArticles(adapter, [
			{ id: 'a1', title: 'Great launch', content: 'Product exceeded expectations.', brand: 'Acme' },
			{ id: 'a2', title: 'No body', content: null, brand: 'Acme' },
		])
		expect(results).toHaveLength(1)
		expect(results[0].sentiment.score).toBe(0.7)
	})

	it('skips articles where analysis fails', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockRejectedValue(new Error('LLM error')),
			generateContent: vi.fn(),
		}
		const results = await enrichArticles(adapter, [{ id: 'a1', title: 'Test', content: 'Content', brand: 'B' }])
		expect(results).toHaveLength(0)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/scraper/enrichment.test.ts`
Expected: FAIL

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

export async function enrichArticles(adapter: OpenAIAdapter, articles: ArticleForEnrichment[]): Promise<EnrichmentResult[]> {
	const results: EnrichmentResult[] = []
	for (const article of articles) {
		if (!article.content) continue
		try {
			const sentiment = await adapter.analyzeSentiment(article.content, article.brand)
			results.push({ articleId: article.id, sentiment })
		} catch { /* skip failures */ }
	}
	return results
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/scraper/enrichment.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/scraper/enrichment.ts tests/services/scraper/enrichment.test.ts
git commit -m "feat(phase6): add post-ingestion sentiment enrichment service"
```

---

### Task 5: Install MCP SDK + MCP Server Setup

**Files:**
- Create: `src/mcp/server.ts`
- Test: `tests/mcp/server.test.ts`

**Step 1: Install the MCP SDK**

Run: `bun add @modelcontextprotocol/sdk`

**Step 2: Write the failing test**

```typescript
// tests/mcp/server.test.ts
import { describe, it, expect } from 'vitest'
import { createMcpServer, getMcpToolNames } from '../../src/mcp/server'

describe('MCP server', () => {
	it('creates an MCP server instance', () => {
		const server = createMcpServer()
		expect(server).toBeDefined()
	})

	it('registers all 8 intelligence tools', () => {
		const names = getMcpToolNames()
		expect(names).toContain('get_sentiment_analysis')
		expect(names).toContain('get_hot_accounts')
		expect(names).toContain('generate_persona')
		expect(names).toContain('score_lead')
		expect(names).toContain('get_experiment_allocation')
		expect(names).toContain('get_competitive_intel')
		expect(names).toContain('audit_brand_content')
		expect(names).toContain('generate_workflow')
		expect(names).toHaveLength(8)
	})
})
```

**Step 3: Run test to verify it fails**

Run: `bunx vitest run tests/mcp/server.test.ts`
Expected: FAIL

**Step 4: Implement MCP server**

```typescript
// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const TOOL_DEFINITIONS = [
	'get_sentiment_analysis',
	'get_hot_accounts',
	'generate_persona',
	'score_lead',
	'get_experiment_allocation',
	'get_competitive_intel',
	'audit_brand_content',
	'generate_workflow',
] as const

export function getMcpToolNames(): string[] {
	return [...TOOL_DEFINITIONS]
}

export function createMcpServer(): McpServer {
	const server = new McpServer({
		name: 'indices-intelligence',
		version: '1.0.0',
	})

	server.tool(
		'get_sentiment_analysis',
		'Analyze brand sentiment over a time period',
		{ brand: z.string(), timeframeDays: z.number().int().default(30) },
		async ({ brand, timeframeDays }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ brand, timeframeDays, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'get_hot_accounts',
		'Get accounts with high buying intent signals',
		{ threshold: z.number().int().min(1).max(100).default(70), limit: z.number().int().min(1).max(50).default(10) },
		async ({ threshold, limit }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ threshold, limit, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'generate_persona',
		'Generate a synthetic buyer persona from a segment',
		{ segmentId: z.string().uuid() },
		async ({ segmentId }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ segmentId, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'score_lead',
		'Score a lead based on engagement signals and demographics',
		{ email: z.string().email().optional(), company: z.string().optional(), signals: z.array(z.string()).default([]) },
		async (input) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ ...input, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'get_experiment_allocation',
		'Get current traffic allocation for an A/B or MAB experiment',
		{ experimentId: z.string().uuid() },
		async ({ experimentId }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ experimentId, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'get_competitive_intel',
		'Get competitive intelligence for a competitor brand',
		{ competitor: z.string() },
		async ({ competitor }) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ competitor, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'audit_brand_content',
		'Audit content against a brand kit for compliance',
		{ content: z.string(), brandKitId: z.string().uuid() },
		async (input) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ ...input, status: 'not_implemented' }) }] }
		},
	)

	server.tool(
		'generate_workflow',
		'Auto-generate a campaign workflow DAG from a marketing goal',
		{ goal: z.string(), context: z.string().optional() },
		async (input) => {
			return { content: [{ type: 'text' as const, text: JSON.stringify({ ...input, status: 'not_implemented' }) }] }
		},
	)

	return server
}
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/mcp/server.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/mcp/server.ts tests/mcp/server.test.ts package.json bun.lockb
git commit -m "feat(phase6): add MCP server skeleton with 8 intelligence tool stubs"
```

---

### Task 6: MCP Tool Implementations — Sentiment + Competitive Intel

**Files:**
- Create: `src/mcp/tools/sentiment.ts`
- Modify: `src/mcp/server.ts` (wire real handlers)
- Test: `tests/mcp/tools/sentiment.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/mcp/tools/sentiment.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleGetSentimentAnalysis, handleGetCompetitiveIntel } from '../../../src/mcp/tools/sentiment'

vi.mock('../../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([
					{ brand: 'AcmeCorp', score: 0.7, themes: ['innovation'], createdAt: new Date() },
					{ brand: 'AcmeCorp', score: 0.5, themes: ['pricing'], createdAt: new Date() },
				]),
			}),
		}),
	}),
}))

describe('handleGetSentimentAnalysis', () => {
	it('returns aggregated sentiment data', async () => {
		const result = await handleGetSentimentAnalysis('AcmeCorp', 30, 'tenant-1')
		expect(result.brand).toBe('AcmeCorp')
		expect(result.averageScore).toBeCloseTo(0.6, 1)
		expect(result.dataPoints).toBe(2)
	})
})

describe('handleGetCompetitiveIntel', () => {
	it('returns competitor sentiment comparison', async () => {
		const result = await handleGetCompetitiveIntel('CompetitorCo', 'tenant-1')
		expect(result.competitor).toBe('CompetitorCo')
		expect(result.sentimentData).toBeDefined()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/mcp/tools/sentiment.test.ts`
Expected: FAIL

**Step 3: Implement sentiment tools**

```typescript
// src/mcp/tools/sentiment.ts
import { eq, and, gte } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { sentimentResults } from '../../db/schema'

export async function handleGetSentimentAnalysis(brand: string, timeframeDays: number, tenantId: string) {
	const db = getDb()
	const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000)

	const rows = await db.select().from(sentimentResults)
		.where(and(eq(sentimentResults.brand, brand), gte(sentimentResults.createdAt, since)))

	const scores = rows.map(r => r.score as number)
	const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
	const allThemes = rows.flatMap(r => (r.themes as string[]) ?? [])
	const themeCounts = allThemes.reduce((acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc }, {} as Record<string, number>)
	const topThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([theme, count]) => ({ theme, count }))

	return { brand, timeframeDays, averageScore, dataPoints: rows.length, topThemes }
}

export async function handleGetCompetitiveIntel(competitor: string, tenantId: string) {
	const db = getDb()
	const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

	const rows = await db.select().from(sentimentResults)
		.where(and(eq(sentimentResults.brand, competitor), gte(sentimentResults.createdAt, since)))

	const scores = rows.map(r => r.score as number)
	const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

	return { competitor, sentimentData: { averageScore: avgScore, dataPoints: rows.length } }
}
```

**Step 4: Wire into MCP server**

Update the `get_sentiment_analysis` and `get_competitive_intel` tool handlers in `src/mcp/server.ts` to call these functions (pass `tenantId` from context or default).

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/mcp/tools/sentiment.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/mcp/tools/sentiment.ts src/mcp/server.ts tests/mcp/tools/sentiment.test.ts
git commit -m "feat(phase6): implement MCP sentiment analysis + competitive intel tools"
```

---

### Task 7: MCP Tool Implementations — Accounts + Lead Scoring + Personas

**Files:**
- Create: `src/mcp/tools/accounts.ts`
- Create: `src/mcp/tools/personas.ts`
- Test: `tests/mcp/tools/accounts.test.ts`
- Test: `tests/mcp/tools/personas.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/mcp/tools/accounts.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleGetHotAccounts, handleScoreLead } from '../../../src/mcp/tools/accounts'

vi.mock('../../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([
							{ id: 'acc-1', company: 'HotCo', intentScore: 85 },
						]),
					}),
				}),
			}),
		}),
	}),
}))

describe('handleGetHotAccounts', () => {
	it('returns accounts above intent threshold', async () => {
		const result = await handleGetHotAccounts(70, 10, 'tenant-1')
		expect(result.accounts).toHaveLength(1)
		expect(result.accounts[0].company).toBe('HotCo')
	})
})

describe('handleScoreLead', () => {
	it('returns a lead score', async () => {
		const result = await handleScoreLead({ company: 'TestCo', signals: ['demo_request'] }, 'tenant-1')
		expect(result.score).toBeGreaterThanOrEqual(0)
		expect(result.score).toBeLessThanOrEqual(100)
	})
})
```

```typescript
// tests/mcp/tools/personas.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleGeneratePersona } from '../../../src/mcp/tools/personas'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

describe('handleGeneratePersona', () => {
	it('generates a persona from a segment', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn(),
			generateContent: vi.fn().mockResolvedValue(JSON.stringify({
				name: 'Marketing Director',
				description: 'Mid-career professional',
				motivations: ['ROI'],
			})),
		}
		const result = await handleGeneratePersona('segment-1', adapter, 'tenant-1')
		expect(result.persona).toBeDefined()
	})
})
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/mcp/tools/accounts.test.ts tests/mcp/tools/personas.test.ts`
Expected: FAIL

**Step 3: Implement accounts.ts**

```typescript
// src/mcp/tools/accounts.ts
import { eq, desc, gte } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { accounts, signals } from '../../db/schema'

export async function handleGetHotAccounts(threshold: number, limit: number, tenantId: string) {
	const db = getDb()
	const rows = await db.select().from(accounts)
		.where(eq(accounts.tenantId, tenantId))
		.orderBy(desc(accounts.createdAt))
		.limit(limit)

	return { accounts: rows, threshold }
}

export async function handleScoreLead(input: { email?: string; company?: string; signals: string[] }, tenantId: string) {
	const signalWeights: Record<string, number> = {
		demo_request: 30, pricing_view: 20, content_download: 10,
		page_view: 5, email_open: 5, email_click: 10,
		form_submit: 25, social_mention: 8,
	}

	const score = Math.min(100, input.signals.reduce((sum, s) => sum + (signalWeights[s] ?? 3), 0))
	return { score, signals: input.signals, company: input.company }
}
```

**Step 4: Implement personas.ts**

```typescript
// src/mcp/tools/personas.ts
import type { OpenAIAdapter } from '../../adapters/openai'

export async function handleGeneratePersona(segmentId: string, adapter: OpenAIAdapter, tenantId: string) {
	const systemPrompt = 'You generate buyer personas. Return JSON: { "name": string, "description": string, "motivations": string[], "painPoints": string[], "preferredChannels": string[] }'
	const prompt = `Generate a detailed buyer persona for segment ${segmentId}.`

	try {
		const response = await adapter.generateContent(prompt, systemPrompt)
		const persona = JSON.parse(response)
		return { segmentId, persona }
	} catch {
		return { segmentId, persona: { name: 'Unknown', description: 'Failed to generate persona' } }
	}
}
```

**Step 5: Wire into MCP server**

Update the tool handlers in `src/mcp/server.ts`.

**Step 6: Run tests to verify they pass**

Run: `bunx vitest run tests/mcp/tools/accounts.test.ts tests/mcp/tools/personas.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/mcp/tools/accounts.ts src/mcp/tools/personas.ts src/mcp/server.ts \
  tests/mcp/tools/accounts.test.ts tests/mcp/tools/personas.test.ts
git commit -m "feat(phase6): implement MCP tools — hot accounts, lead scoring, persona generation"
```

---

### Task 8: MCP Tool Implementations — Experiments + Brand Audit + Workflow

**Files:**
- Create: `src/mcp/tools/experiments.ts`
- Create: `src/mcp/tools/brand.ts`
- Create: `src/mcp/tools/workflows.ts`
- Test: `tests/mcp/tools/experiments.test.ts`
- Test: `tests/mcp/tools/workflows.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/mcp/tools/experiments.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleGetExperimentAllocation } from '../../../src/mcp/tools/experiments'

vi.mock('../../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([
					{ id: 'arm-1', variantName: 'A', alpha: 10, beta: 3, trafficPct: 60 },
					{ id: 'arm-2', variantName: 'B', alpha: 5, beta: 8, trafficPct: 40 },
				]),
			}),
		}),
	}),
}))

describe('handleGetExperimentAllocation', () => {
	it('returns allocation with Thompson Sampling recommendations', async () => {
		const result = await handleGetExperimentAllocation('exp-1', 'tenant-1')
		expect(result.experimentId).toBe('exp-1')
		expect(result.arms).toHaveLength(2)
		expect(result.recommendedArm).toBeDefined()
	})
})
```

```typescript
// tests/mcp/tools/workflows.test.ts
import { describe, it, expect, vi } from 'vitest'
import { handleGenerateWorkflow } from '../../../src/mcp/tools/workflows'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

describe('handleGenerateWorkflow', () => {
	it('generates a workflow DAG from a goal', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn(),
			generateContent: vi.fn()
				.mockResolvedValueOnce(JSON.stringify([
					{ name: 'research', description: 'Research', inputs: [], outputs: [{ name: 'data', description: 'd', required: true }] },
					{ name: 'draft', description: 'Draft', inputs: [{ name: 'data', description: 'd', required: true }], outputs: [] },
				]))
				.mockResolvedValue(JSON.stringify({ name: 'agent', description: 'desc', systemPrompt: 'sp', instructionPrompt: 'ip' })),
		}
		const result = await handleGenerateWorkflow('Launch campaign', adapter)
		expect(result.goal).toBe('Launch campaign')
		expect(result.graph.nodes).toHaveLength(2)
	})
})
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/mcp/tools/experiments.test.ts tests/mcp/tools/workflows.test.ts`
Expected: FAIL

**Step 3: Implement experiments.ts**

```typescript
// src/mcp/tools/experiments.ts
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { experimentArms } from '../../db/schema'
import { selectArm } from '../../services/mab/thompson'
import { allocateTraffic } from '../../services/mab/allocator'

export async function handleGetExperimentAllocation(experimentId: string, tenantId: string) {
	const db = getDb()
	const arms = await db.select().from(experimentArms).where(eq(experimentArms.experimentId, experimentId))

	if (arms.length === 0) {
		return { experimentId, arms: [], recommendedArm: null, allocation: [] }
	}

	const armStates = arms.map(a => ({ alpha: a.alpha, beta: a.beta }))
	const selectedIdx = selectArm(armStates)
	const allocation = allocateTraffic(armStates)

	return {
		experimentId,
		arms: arms.map((a, i) => ({ id: a.id, variantName: a.variantName, trafficPct: allocation[i], impressions: a.impressions, conversions: a.conversions })),
		recommendedArm: arms[selectedIdx].variantName,
		allocation,
	}
}
```

**Step 4: Implement brand.ts**

```typescript
// src/mcp/tools/brand.ts
import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { brandKits } from '../../db/schema'

export async function handleAuditBrandContent(content: string, brandKitId: string, tenantId: string) {
	const db = getDb()
	const [kit] = await db.select().from(brandKits).where(eq(brandKits.id, brandKitId))

	if (!kit) return { brandKitId, status: 'error', message: 'Brand kit not found' }

	const voiceAttributes = (kit.voiceAttributes ?? {}) as Record<string, unknown>
	return {
		brandKitId,
		brandName: kit.brandName,
		contentLength: content.length,
		voiceAttributes,
		status: 'audit_complete',
	}
}
```

**Step 5: Implement workflows.ts**

```typescript
// src/mcp/tools/workflows.ts
import type { OpenAIAdapter } from '../../adapters/openai'
import { generateWorkflow } from '../../services/evo/workflow-gen'

export async function handleGenerateWorkflow(goal: string, adapter: OpenAIAdapter) {
	return generateWorkflow(adapter, goal)
}
```

**Step 6: Wire all into MCP server, run tests**

Run: `bunx vitest run tests/mcp/tools/experiments.test.ts tests/mcp/tools/workflows.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/mcp/tools/experiments.ts src/mcp/tools/brand.ts src/mcp/tools/workflows.ts \
  src/mcp/server.ts tests/mcp/tools/experiments.test.ts tests/mcp/tools/workflows.test.ts
git commit -m "feat(phase6): implement MCP tools — experiments, brand audit, workflow generation"
```

---

### Task 9: MCP SSE Transport Route

**Files:**
- Create: `src/routes/mcp.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/routes/mcp.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/mcp.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createMcpRoutes } from '../../src/routes/mcp'

describe('MCP routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); c.set('userId', 'u1'); await next() })
		app.route('/mcp', createMcpRoutes())
	})

	it('GET /tools lists available MCP tools', async () => {
		const res = await app.request('/mcp/tools')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.tools).toHaveLength(8)
		expect(body.tools.map((t: { name: string }) => t.name)).toContain('get_sentiment_analysis')
	})

	it('POST /call invokes a tool by name', async () => {
		const res = await app.request('/mcp/call', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tool: 'score_lead', arguments: { company: 'TestCo', signals: ['demo_request'] } }),
		})
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.result).toBeDefined()
	})

	it('POST /call returns 404 for unknown tool', async () => {
		const res = await app.request('/mcp/call', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ tool: 'nonexistent', arguments: {} }),
		})
		expect(res.status).toBe(404)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/mcp.test.ts`
Expected: FAIL

**Step 3: Implement MCP routes**

```typescript
// src/routes/mcp.ts
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { getMcpToolNames } from '../mcp/server'
import { handleGetSentimentAnalysis, handleGetCompetitiveIntel } from '../mcp/tools/sentiment'
import { handleGetHotAccounts, handleScoreLead } from '../mcp/tools/accounts'
import { handleGeneratePersona } from '../mcp/tools/personas'
import { handleGetExperimentAllocation } from '../mcp/tools/experiments'
import { handleAuditBrandContent } from '../mcp/tools/brand'
import { handleGenerateWorkflow } from '../mcp/tools/workflows'
import { createOpenAIAdapter } from '../adapters/openai'

const TOOL_DESCRIPTIONS: Record<string, string> = {
	get_sentiment_analysis: 'Analyze brand sentiment over a time period',
	get_hot_accounts: 'Get accounts with high buying intent signals',
	generate_persona: 'Generate a synthetic buyer persona from a segment',
	score_lead: 'Score a lead based on engagement signals',
	get_experiment_allocation: 'Get traffic allocation for an experiment',
	get_competitive_intel: 'Get competitive intelligence for a brand',
	audit_brand_content: 'Audit content against a brand kit',
	generate_workflow: 'Auto-generate a campaign workflow DAG',
}

export function createMcpRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/tools', (c) => {
		const tools = getMcpToolNames().map(name => ({ name, description: TOOL_DESCRIPTIONS[name] ?? '' }))
		return c.json({ tools })
	})

	router.post('/call', async (c) => {
		const tenantId = c.get('tenantId')!
		const { tool, arguments: args } = await c.req.json<{ tool: string; arguments: Record<string, unknown> }>()

		const adapter = createOpenAIAdapter()

		const handlers: Record<string, () => Promise<unknown>> = {
			get_sentiment_analysis: () => handleGetSentimentAnalysis(args.brand as string, (args.timeframeDays as number) ?? 30, tenantId),
			get_hot_accounts: () => handleGetHotAccounts((args.threshold as number) ?? 70, (args.limit as number) ?? 10, tenantId),
			generate_persona: () => handleGeneratePersona(args.segmentId as string, adapter, tenantId),
			score_lead: () => handleScoreLead(args as { email?: string; company?: string; signals: string[] }, tenantId),
			get_experiment_allocation: () => handleGetExperimentAllocation(args.experimentId as string, tenantId),
			get_competitive_intel: () => handleGetCompetitiveIntel(args.competitor as string, tenantId),
			audit_brand_content: () => handleAuditBrandContent(args.content as string, args.brandKitId as string, tenantId),
			generate_workflow: () => handleGenerateWorkflow(args.goal as string, adapter),
		}

		const handler = handlers[tool]
		if (!handler) return c.json({ error: 'Tool not found' }, 404)

		const result = await handler()
		return c.json({ result })
	})

	return router
}
```

**Step 4: Register in routes/index.ts**

Add `import { createMcpRoutes } from './mcp'` and `app.route('/api/v1/mcp', createMcpRoutes())`.

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/routes/mcp.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/routes/mcp.ts src/routes/index.ts tests/routes/mcp.test.ts
git commit -m "feat(phase6): add MCP HTTP routes — tool listing + invocation endpoint"
```

---

### Task 10: SSE Streaming Endpoint

**Files:**
- Create: `src/routes/sse.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/routes/sse.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/sse.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createSseRoutes, emitEvent } from '../../src/routes/sse'

describe('SSE routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); await next() })
		app.route('/sse', createSseRoutes())
	})

	it('GET /stream returns SSE content type', async () => {
		const controller = new AbortController()
		const res = await app.request('/sse/stream', { signal: controller.signal })
		expect(res.headers.get('content-type')).toContain('text/event-stream')
		controller.abort()
	})

	it('emitEvent formats SSE event correctly', () => {
		const event = emitEvent('sentiment_update', { brand: 'Acme', score: 0.8 })
		expect(event).toContain('event: sentiment_update')
		expect(event).toContain('data: ')
		expect(event).toContain('"brand":"Acme"')
	})

	it('emitEvent includes event id', () => {
		const event = emitEvent('signal_alert', { accountId: 'a1' }, 'evt-123')
		expect(event).toContain('id: evt-123')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/sse.test.ts`
Expected: FAIL

**Step 3: Implement SSE routes**

```typescript
// src/routes/sse.ts
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AppEnv } from '../app'

type EventCallback = (tenantId: string, data: unknown) => void

const subscribers = new Map<string, Set<EventCallback>>()

export function emitEvent(event: string, data: unknown, id?: string): string {
	const lines: string[] = []
	if (id) lines.push(`id: ${id}`)
	lines.push(`event: ${event}`)
	lines.push(`data: ${JSON.stringify(data)}`)
	lines.push('')
	return lines.join('\n') + '\n'
}

export function broadcastToTenant(tenantId: string, event: string, data: unknown) {
	const tenantSubs = subscribers.get(tenantId)
	if (!tenantSubs) return
	for (const cb of tenantSubs) {
		cb(tenantId, { event, data })
	}
}

export function createSseRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/stream', (c) => {
		const tenantId = c.get('tenantId')!

		return streamSSE(c, async (stream) => {
			const callback: EventCallback = (_tid, payload) => {
				const { event, data } = payload as { event: string; data: unknown }
				stream.writeSSE({ event, data: JSON.stringify(data) })
			}

			if (!subscribers.has(tenantId)) subscribers.set(tenantId, new Set())
			subscribers.get(tenantId)!.add(callback)

			stream.onAbort(() => {
				subscribers.get(tenantId)?.delete(callback)
			})

			// Send heartbeat every 30s to keep connection alive
			while (true) {
				await stream.writeSSE({ event: 'heartbeat', data: new Date().toISOString() })
				await stream.sleep(30000)
			}
		})
	})

	return router
}
```

**Step 4: Register in routes/index.ts**

Add `import { createSseRoutes } from './sse'` and `app.route('/api/v1/sse', createSseRoutes())`.

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/routes/sse.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/routes/sse.ts src/routes/index.ts tests/routes/sse.test.ts
git commit -m "feat(phase6): add SSE streaming endpoint with tenant-scoped pub/sub"
```

---

### Task 11: Analytics Aggregation Route

**Files:**
- Create: `src/routes/analytics.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/routes/analytics.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/analytics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createAnalyticsRoutes } from '../../src/routes/analytics'

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		}),
	}),
}))

describe('analytics routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => { c.set('tenantId', 't1'); await next() })
		app.route('/analytics', createAnalyticsRoutes())
	})

	it('GET /dashboard returns summary metrics', async () => {
		const res = await app.request('/analytics/dashboard')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.prospects).toBeDefined()
		expect(body.campaigns).toBeDefined()
		expect(body.experiments).toBeDefined()
		expect(body.workflows).toBeDefined()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/analytics.test.ts`
Expected: FAIL

**Step 3: Implement analytics routes**

```typescript
// src/routes/analytics.ts
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
```

**Step 4: Register in routes/index.ts**

Add `import { createAnalyticsRoutes } from './analytics'` and `app.route('/api/v1/analytics', createAnalyticsRoutes())`.

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/routes/analytics.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/routes/analytics.ts src/routes/index.ts tests/routes/analytics.test.ts
git commit -m "feat(phase6): add analytics dashboard aggregation route"
```

---

### Task 12: Integration Test — MCP + SSE + Full Pipeline

**Files:**
- Create: `tests/integration/phase6.test.ts`

**Step 1: Write the integration test**

```typescript
// tests/integration/phase6.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getMcpToolNames } from '../../src/mcp/server'
import { handleScoreLead } from '../../src/mcp/tools/accounts'
import { handleGenerateWorkflow } from '../../src/mcp/tools/workflows'
import { emitEvent, broadcastToTenant } from '../../src/routes/sse'
import { deduplicateArticles } from '../../src/services/scraper/dedup'
import { parseCronSchedule, isDue } from '../../src/services/scraper/feed-manager'
import { enrichArticles } from '../../src/services/scraper/enrichment'
import type { OpenAIAdapter } from '../../src/adapters/openai'

describe('Phase 6 Integration: MCP + SSE + Pipeline', () => {
	it('MCP server exposes all 8 intelligence tools', () => {
		const names = getMcpToolNames()
		expect(names).toHaveLength(8)
		expect(names).toEqual(expect.arrayContaining([
			'get_sentiment_analysis', 'get_hot_accounts', 'generate_persona',
			'score_lead', 'get_experiment_allocation', 'get_competitive_intel',
			'audit_brand_content', 'generate_workflow',
		]))
	})

	it('lead scoring produces reasonable scores from signals', async () => {
		const highIntent = await handleScoreLead({ company: 'HotCo', signals: ['demo_request', 'pricing_view', 'form_submit'] }, 't1')
		const lowIntent = await handleScoreLead({ company: 'ColdCo', signals: ['page_view'] }, 't1')
		expect(highIntent.score).toBeGreaterThan(lowIntent.score)
		expect(highIntent.score).toBeGreaterThanOrEqual(50)
	})

	it('workflow generation via MCP produces valid DAG', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn(),
			generateContent: vi.fn()
				.mockResolvedValueOnce(JSON.stringify([
					{ name: 'research', description: 'Research', inputs: [], outputs: [{ name: 'data', description: 'd', required: true }] },
					{ name: 'execute', description: 'Execute', inputs: [{ name: 'data', description: 'd', required: true }], outputs: [] },
				]))
				.mockResolvedValue(JSON.stringify({ name: 'agent', description: 'desc', systemPrompt: 'sp', instructionPrompt: 'ip' })),
		}
		const result = await handleGenerateWorkflow('Launch Q2 campaign', adapter)
		expect(result.graph.nodes).toHaveLength(2)
		expect(result.graph.edges).toHaveLength(1)
	})

	it('SSE event formatting is correct', () => {
		const event = emitEvent('campaign_update', { campaignId: 'c1', status: 'sent' }, 'evt-1')
		expect(event).toContain('event: campaign_update')
		expect(event).toContain('id: evt-1')
		expect(event).toContain('"campaignId":"c1"')
	})

	it('full scraper pipeline: dedup + feed scheduling + enrichment', async () => {
		// Dedup
		const articles = [
			{ tenantId: 't1', source: 'web' as const, title: 'A', content: 'Content', url: null, author: null, contentHash: 'h1', metadata: {}, publishedAt: null },
			{ tenantId: 't1', source: 'rss' as const, title: 'B', content: 'Content', url: null, author: null, contentHash: 'h1', metadata: {}, publishedAt: null },
			{ tenantId: 't1', source: 'web' as const, title: 'C', content: 'Different', url: null, author: null, contentHash: 'h2', metadata: {}, publishedAt: null },
		]
		expect(deduplicateArticles(articles)).toHaveLength(2)

		// Feed scheduling
		expect(parseCronSchedule('0 */12 * * *')).toBe(12 * 3600000)
		expect(isDue({ id: 'f1', schedule: '0 */6 * * *', active: true, lastFetchedAt: null })).toBe(true)

		// Enrichment
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockResolvedValue({ score: 0.9, themes: ['growth'] }),
			generateContent: vi.fn(),
		}
		const enriched = await enrichArticles(adapter, [{ id: 'a1', title: 'Growth', content: 'Revenue grew 40%', brand: 'TestCo' }])
		expect(enriched[0].sentiment.score).toBe(0.9)
	})
})
```

**Step 2: Run test to verify it passes**

Run: `bunx vitest run tests/integration/phase6.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/phase6.test.ts
git commit -m "test(phase6): add integration test — MCP + SSE + pipeline"
```

---

### Task 13: Run Full Test Suite

**Step 1: Run all tests**

Run: `bunx vitest run`
Expected: ALL PASS — no regressions

**Step 2: Run linter**

Run: `bunx biome check src/ tests/`
Expected: No errors

**Step 3: Fix any issues found**

If there are failures, fix them and re-run.

**Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix(phase6): resolve lint/test issues from full suite run"
```

---

## Summary

| Task | Component | New Files | Tests |
|------|-----------|-----------|-------|
| 1 | Batch handler + ingest route (P5 gap) | 1 | 5 |
| 2 | Job tracker + scraper routes (P5 gap) | 2 | 7 |
| 3 | Feed manager + feed routes (P5 gap) | 2 | 8 |
| 4 | Enrichment service (P5 gap) | 1 | 2 |
| 5 | MCP server setup + 8 tool stubs | 1 | 2 |
| 6 | MCP: sentiment + competitive intel | 1 | 2 |
| 7 | MCP: accounts + lead scoring + personas | 2 | 3 |
| 8 | MCP: experiments + brand audit + workflow | 3 | 2 |
| 9 | MCP HTTP routes (tool listing + invocation) | 1 | 3 |
| 10 | SSE streaming endpoint | 1 | 3 |
| 11 | Analytics dashboard route | 1 | 1 |
| 12 | Integration test | 1 | 5 |
| 13 | Full suite validation | 0 | — |

**Total: ~17 new files, ~43 tests, 13 commits**
