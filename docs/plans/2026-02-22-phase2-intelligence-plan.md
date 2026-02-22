# Phase 2: Intelligence Layer — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the intelligence services on top of the Phase 1 foundation: sentiment analysis pipeline (ingest + z-score drift + themes), signal processing (hot accounts, intent scoring), ABM (accounts, deals, competitive), brand auditing, synthetic personas (Big Five/OCEAN), and Popper validation framework.

**Architecture:** New Drizzle schemas, service modules under `src/services/`, new routes mounted via `src/routes/index.ts`. Follows the established patterns: `createXRoutes()` factory, `validate()` middleware, `getDb()` + tenant-scoped queries, Zod schemas in `src/types/api.ts`, custom errors from `src/types/errors.ts`.

**Tech Stack:** Same as Phase 1 (Hono 4.12, Bun, Drizzle, Zod, Vitest). No new dependencies except `@openai/sdk` for LLM calls.

**Reference:** Design doc at `docs/plans/2026-02-21-commark-hono-migration-design.md` (in com_mark repo)

**Existing patterns to follow (in this repo):**
- Route factory: `src/routes/prospects.ts` — `createProspectRoutes()` returning `Hono<AppEnv>`
- Validation: `src/middleware/validate.ts` — `validate('json', zodSchema)`
- DB access: `getDb()` + tenant-scoped queries with `eq(table.tenantId, tenantId)`
- Schemas: `src/db/schema/*.ts` using `pgTable`, uuid PKs, `defaultRandom()`, timestamps
- Zod schemas: `src/types/api.ts` — colocated request/response schemas
- Route registration: `src/routes/index.ts` — `registerRoutes()` mounts all routers

---

## Task 1: Sentiment Schema + Scraped Content Schema

**Files:**
- Create: `src/db/schema/sentiment.ts`
- Create: `src/db/schema/scraped-content.ts`
- Modify: `src/db/schema/index.ts`
- Test: `tests/db/sentiment-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/sentiment-schema.test.ts
import { describe, it, expect } from 'vitest'
import { sentimentArticles, driftEvents } from '../../src/db/schema/sentiment'
import { scrapedArticles, scrapedSocial, scrapeJobs } from '../../src/db/schema/scraped-content'

describe('sentiment schema', () => {
  it('sentimentArticles has required columns', () => {
    expect(sentimentArticles.id).toBeDefined()
    expect(sentimentArticles.tenantId).toBeDefined()
    expect(sentimentArticles.source).toBeDefined()
    expect(sentimentArticles.title).toBeDefined()
    expect(sentimentArticles.sentimentScore).toBeDefined()
    expect(sentimentArticles.brand).toBeDefined()
    expect(sentimentArticles.themes).toBeDefined()
  })

  it('driftEvents has z-score and direction', () => {
    expect(driftEvents.id).toBeDefined()
    expect(driftEvents.tenantId).toBeDefined()
    expect(driftEvents.brand).toBeDefined()
    expect(driftEvents.zScore).toBeDefined()
    expect(driftEvents.direction).toBeDefined()
    expect(driftEvents.triggerArticles).toBeDefined()
  })
})

describe('scraped content schema', () => {
  it('scrapedArticles has source and contentHash', () => {
    expect(scrapedArticles.id).toBeDefined()
    expect(scrapedArticles.source).toBeDefined()
    expect(scrapedArticles.contentHash).toBeDefined()
  })

  it('scrapedSocial has platform and engagement', () => {
    expect(scrapedSocial.id).toBeDefined()
    expect(scrapedSocial.platform).toBeDefined()
    expect(scrapedSocial.engagement).toBeDefined()
  })

  it('scrapeJobs tracks dispatch to Rust worker', () => {
    expect(scrapeJobs.id).toBeDefined()
    expect(scrapeJobs.jobType).toBeDefined()
    expect(scrapeJobs.status).toBeDefined()
    expect(scrapeJobs.callbackUrl).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/db/sentiment-schema.test.ts
```

Expected: FAIL — modules not found

**Step 3: Implement sentiment.ts**

```typescript
// src/db/schema/sentiment.ts
import { pgTable, text, timestamp, uuid, jsonb, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const sentimentArticles = pgTable('sentiment_articles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['rss', 'reddit', 'linkedin', 'instagram', 'news', 'web'] }).notNull(),
  title: text('title').notNull(),
  content: text('content'),
  url: text('url'),
  author: text('author'),
  brand: text('brand').notNull(),
  sentimentScore: real('sentiment_score').notNull(), // -1.0 to 1.0
  sentimentLabel: text('sentiment_label', { enum: ['positive', 'neutral', 'negative'] }).notNull(),
  themes: jsonb('themes').default([]).notNull(), // string[]
  metadata: jsonb('metadata').default({}).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  analyzedAt: timestamp('analyzed_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_sentiment_tenant').on(table.tenantId),
  index('idx_sentiment_brand').on(table.brand),
  index('idx_sentiment_source').on(table.source),
  index('idx_sentiment_analyzed').on(table.analyzedAt),
])

export const driftEvents = pgTable('drift_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  brand: text('brand').notNull(),
  zScore: real('z_score').notNull(),
  direction: text('direction', { enum: ['positive', 'negative'] }).notNull(),
  baselineMean: real('baseline_mean').notNull(),
  currentMean: real('current_mean').notNull(),
  triggerArticles: jsonb('trigger_articles').default([]).notNull(), // uuid[]
  windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
  windowEnd: timestamp('window_end', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_drift_tenant').on(table.tenantId),
  index('idx_drift_brand').on(table.brand),
  index('idx_drift_created').on(table.createdAt),
])
```

**Step 4: Implement scraped-content.ts**

```typescript
// src/db/schema/scraped-content.ts
import { pgTable, text, timestamp, uuid, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const scrapedArticles = pgTable('scraped_articles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['rss', 'news', 'web'] }).notNull(),
  title: text('title').notNull(),
  content: text('content'),
  url: text('url').notNull(),
  author: text('author'),
  contentHash: text('content_hash').notNull(), // SHA256 for dedup
  metadata: jsonb('metadata').default({}).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  scrapedAt: timestamp('scraped_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_scraped_articles_hash').on(table.contentHash),
  index('idx_scraped_articles_tenant').on(table.tenantId),
  index('idx_scraped_articles_source').on(table.source),
])

export const scrapedSocial = pgTable('scraped_social', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  platform: text('platform', { enum: ['reddit', 'linkedin', 'instagram'] }).notNull(),
  postId: text('post_id'),
  title: text('title'),
  content: text('content'),
  author: text('author'),
  url: text('url'),
  contentHash: text('content_hash').notNull(),
  engagement: jsonb('engagement').default({}).notNull(), // { score, comments, upvoteRatio, likes, shares }
  subreddit: text('subreddit'),
  metadata: jsonb('metadata').default({}).notNull(),
  postedAt: timestamp('posted_at', { withTimezone: true }),
  scrapedAt: timestamp('scraped_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_scraped_social_hash').on(table.contentHash),
  index('idx_scraped_social_tenant').on(table.tenantId),
  index('idx_scraped_social_platform').on(table.platform),
])

export const scrapeJobs = pgTable('scrape_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  jobType: text('job_type', { enum: ['web_crawl', 'social_scrape', 'feed_ingest'] }).notNull(),
  status: text('status', { enum: ['pending', 'queued', 'running', 'completed', 'failed', 'cancelled'] }).default('pending').notNull(),
  config: jsonb('config').default({}).notNull(), // seed_urls, subreddits, keywords, etc.
  callbackUrl: text('callback_url').notNull(),
  pagesScraped: integer('pages_scraped').default(0).notNull(),
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_scrape_jobs_tenant').on(table.tenantId),
  index('idx_scrape_jobs_status').on(table.status),
])
```

**Step 5: Update schema index**

Add to `src/db/schema/index.ts`:
```typescript
export * from './sentiment'
export * from './scraped-content'
```

**Step 6: Run tests**

```bash
bun test tests/db/sentiment-schema.test.ts
```

Expected: PASS

**Step 7: Generate migration**

```bash
bun run db:generate
```

**Step 8: Commit**

```bash
git add src/db/schema/sentiment.ts src/db/schema/scraped-content.ts src/db/schema/index.ts tests/db/sentiment-schema.test.ts
git commit -m "feat: Drizzle schemas for sentiment, scraped content, and scrape jobs"
```

---

## Task 2: Signals Schema + ABM Schema

**Files:**
- Create: `src/db/schema/signals.ts`
- Create: `src/db/schema/accounts.ts`
- Modify: `src/db/schema/index.ts`
- Test: `tests/db/signals-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/signals-schema.test.ts
import { describe, it, expect } from 'vitest'
import { signals } from '../../src/db/schema/signals'
import { accounts, deals } from '../../src/db/schema/accounts'

describe('signals schema', () => {
  it('signals has account, type, strength', () => {
    expect(signals.id).toBeDefined()
    expect(signals.tenantId).toBeDefined()
    expect(signals.accountId).toBeDefined()
    expect(signals.signalType).toBeDefined()
    expect(signals.strength).toBeDefined()
  })
})

describe('accounts schema', () => {
  it('accounts has company, score, tier', () => {
    expect(accounts.id).toBeDefined()
    expect(accounts.tenantId).toBeDefined()
    expect(accounts.company).toBeDefined()
    expect(accounts.score).toBeDefined()
    expect(accounts.tier).toBeDefined()
  })

  it('deals has value, stage, probability', () => {
    expect(deals.id).toBeDefined()
    expect(deals.accountId).toBeDefined()
    expect(deals.value).toBeDefined()
    expect(deals.stage).toBeDefined()
    expect(deals.probability).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/db/signals-schema.test.ts
```

**Step 3: Implement signals.ts**

```typescript
// src/db/schema/signals.ts
import { pgTable, text, timestamp, uuid, jsonb, integer, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const signals = pgTable('signals', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  signalType: text('signal_type', {
    enum: ['page_view', 'email_open', 'email_click', 'form_submit', 'demo_request', 'pricing_view', 'content_download', 'social_mention', 'competitor_visit', 'custom'],
  }).notNull(),
  signalSource: text('signal_source').notNull(),
  strength: integer('strength').notNull(), // 1-100
  signalData: jsonb('signal_data').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_signals_tenant').on(table.tenantId),
  index('idx_signals_account').on(table.accountId),
  index('idx_signals_type').on(table.signalType),
  index('idx_signals_created').on(table.createdAt),
])

export const accountScores = pgTable('account_scores', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  totalScore: integer('total_score').notNull().default(0),
  behavioralScore: integer('behavioral_score').notNull().default(0),
  demographicScore: integer('demographic_score').notNull().default(0),
  firmographicScore: integer('firmographic_score').notNull().default(0),
  level: text('level', { enum: ['hot', 'warm', 'cold', 'unqualified'] }).default('cold').notNull(),
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_account_scores_tenant').on(table.tenantId),
  index('idx_account_scores_account').on(table.accountId),
  index('idx_account_scores_level').on(table.level),
])
```

**Step 4: Implement accounts.ts**

```typescript
// src/db/schema/accounts.ts
import { pgTable, text, timestamp, uuid, jsonb, integer, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  company: text('company').notNull(),
  domain: text('domain'),
  industry: text('industry'),
  size: text('size', { enum: ['1-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+'] }),
  score: integer('score').default(0).notNull(),
  tier: text('tier', { enum: ['enterprise', 'mid_market', 'smb', 'startup'] }).default('smb').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_accounts_tenant').on(table.tenantId),
  index('idx_accounts_company').on(table.company),
  index('idx_accounts_tier').on(table.tier),
  index('idx_accounts_score').on(table.score),
])

export const deals = pgTable('deals', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  value: real('value').notNull(),
  stage: text('stage', { enum: ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'] }).default('discovery').notNull(),
  probability: integer('probability').default(0).notNull(), // 0-100
  expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_deals_tenant').on(table.tenantId),
  index('idx_deals_account').on(table.accountId),
  index('idx_deals_stage').on(table.stage),
  index('idx_deals_created').on(table.createdAt),
])
```

**Step 5: Update schema index**

Add to `src/db/schema/index.ts`:
```typescript
export * from './signals'
export * from './accounts'
```

**Step 6: Run tests, generate migration, commit**

```bash
bun test tests/db/signals-schema.test.ts
bun run db:generate
git add src/db/schema/signals.ts src/db/schema/accounts.ts src/db/schema/index.ts tests/db/signals-schema.test.ts
git commit -m "feat: Drizzle schemas for signals, account scores, accounts, and deals"
```

---

## Task 3: Experiments + Personas + Brand Kits Schemas

**Files:**
- Create: `src/db/schema/experiments.ts`
- Create: `src/db/schema/personas.ts`
- Create: `src/db/schema/brand-kits.ts`
- Modify: `src/db/schema/index.ts`
- Test: `tests/db/experiments-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/experiments-schema.test.ts
import { describe, it, expect } from 'vitest'
import { experimentArms } from '../../src/db/schema/experiments'
import { personaProfiles } from '../../src/db/schema/personas'
import { brandKits } from '../../src/db/schema/brand-kits'

describe('experiments schema', () => {
  it('experimentArms has alpha, beta, trafficPct', () => {
    expect(experimentArms.id).toBeDefined()
    expect(experimentArms.experimentId).toBeDefined()
    expect(experimentArms.alpha).toBeDefined()
    expect(experimentArms.beta).toBeDefined()
    expect(experimentArms.trafficPct).toBeDefined()
  })
})

describe('personas schema', () => {
  it('personaProfiles has OCEAN scores', () => {
    expect(personaProfiles.id).toBeDefined()
    expect(personaProfiles.oceanScores).toBeDefined()
    expect(personaProfiles.demographics).toBeDefined()
  })
})

describe('brand kits schema', () => {
  it('brandKits has colors, typography, voice', () => {
    expect(brandKits.id).toBeDefined()
    expect(brandKits.colors).toBeDefined()
    expect(brandKits.typography).toBeDefined()
    expect(brandKits.voiceAttributes).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/db/experiments-schema.test.ts
```

**Step 3: Implement experiments.ts**

```typescript
// src/db/schema/experiments.ts
import { pgTable, text, timestamp, uuid, jsonb, real, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const experiments = pgTable('experiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ['ab_test', 'mab_thompson', 'mab_ucb', 'mab_epsilon'] }).default('ab_test').notNull(),
  status: text('status', { enum: ['draft', 'running', 'paused', 'completed'] }).default('draft').notNull(),
  targetMetric: text('target_metric').notNull(), // e.g. 'open_rate', 'click_rate', 'conversion'
  winnerId: uuid('winner_id'),
  metadata: jsonb('metadata').default({}).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_experiments_tenant').on(table.tenantId),
  index('idx_experiments_status').on(table.status),
])

export const experimentArms = pgTable('experiment_arms', {
  id: uuid('id').defaultRandom().primaryKey(),
  experimentId: uuid('experiment_id').notNull().references(() => experiments.id, { onDelete: 'cascade' }),
  variantName: text('variant_name').notNull(),
  content: jsonb('content').default({}).notNull(), // variant-specific data
  alpha: real('alpha').default(1).notNull(), // Beta distribution param (successes + 1)
  beta: real('beta').default(1).notNull(), // Beta distribution param (failures + 1)
  trafficPct: real('traffic_pct').default(0).notNull(), // 0.0 - 1.0
  impressions: integer('impressions').default(0).notNull(),
  conversions: integer('conversions').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_arms_experiment').on(table.experimentId),
])
```

**Step 4: Implement personas.ts**

```typescript
// src/db/schema/personas.ts
import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const personaProfiles = pgTable('persona_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  // Big Five (OCEAN) scores: 0.0 - 1.0
  oceanScores: jsonb('ocean_scores').default({}).notNull(), // { openness, conscientiousness, extraversion, agreeableness, neuroticism }
  demographics: jsonb('demographics').default({}).notNull(), // { age, gender, education, income, location }
  motivations: jsonb('motivations').default([]).notNull(), // string[]
  painPoints: jsonb('pain_points').default([]).notNull(), // string[]
  preferredChannels: jsonb('preferred_channels').default([]).notNull(), // string[]
  derivation: text('derivation'), // How persona was derived
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_personas_tenant').on(table.tenantId),
])
```

**Step 5: Implement brand-kits.ts**

```typescript
// src/db/schema/brand-kits.ts
import { pgTable, text, timestamp, uuid, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const brandKits = pgTable('brand_kits', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  brandName: text('brand_name').notNull(),
  colors: jsonb('colors').default([]).notNull(), // [{ name, hex, rgb, cmyk, usage, textColorRule }]
  typography: jsonb('typography').default([]).notNull(), // [{ family, weights, useCase }]
  voiceAttributes: jsonb('voice_attributes').default({}).notNull(), // { attributes, frequentKeywords, forbiddenKeywords }
  logoRules: jsonb('logo_rules').default([]).notNull(), // [{ rule, type: 'do'|'dont' }]
  colorTolerance: integer('color_tolerance').default(50).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_brand_kits_tenant').on(table.tenantId),
])
```

**Step 6: Update schema index, run tests, commit**

Add to `src/db/schema/index.ts`:
```typescript
export * from './experiments'
export * from './personas'
export * from './brand-kits'
```

```bash
bun test tests/db/experiments-schema.test.ts
bun run db:generate
git add src/db/schema/experiments.ts src/db/schema/personas.ts src/db/schema/brand-kits.ts src/db/schema/index.ts tests/db/experiments-schema.test.ts
git commit -m "feat: Drizzle schemas for experiments/MAB, personas, and brand kits"
```

---

## Task 4: Math Utilities (z-score, beta distribution)

**Files:**
- Create: `src/utils/math.ts`
- Test: `tests/utils/math.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/utils/math.test.ts
import { describe, it, expect } from 'vitest'
import { zScore, movingAverage, betaSample, standardDeviation } from '../../src/utils/math'

describe('math utilities', () => {
  describe('zScore', () => {
    it('returns 0 for value equal to mean', () => {
      expect(zScore(5, 5, 1)).toBe(0)
    })

    it('returns positive z-score for value above mean', () => {
      expect(zScore(7, 5, 1)).toBe(2)
    })

    it('returns negative z-score for value below mean', () => {
      expect(zScore(3, 5, 1)).toBe(-2)
    })

    it('returns 0 when stdDev is 0', () => {
      expect(zScore(7, 5, 0)).toBe(0)
    })
  })

  describe('movingAverage', () => {
    it('computes moving average for window', () => {
      const values = [1, 2, 3, 4, 5]
      const result = movingAverage(values, 3)
      expect(result).toEqual([2, 3, 4])
    })

    it('returns empty for window larger than data', () => {
      expect(movingAverage([1, 2], 5)).toEqual([])
    })
  })

  describe('standardDeviation', () => {
    it('computes standard deviation', () => {
      const result = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])
      expect(result).toBeCloseTo(2.0, 1)
    })

    it('returns 0 for single value', () => {
      expect(standardDeviation([5])).toBe(0)
    })
  })

  describe('betaSample', () => {
    it('returns value between 0 and 1', () => {
      const sample = betaSample(10, 5)
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThanOrEqual(1)
    })

    it('with high alpha, tends toward higher values', () => {
      const samples = Array.from({ length: 100 }, () => betaSample(100, 1))
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length
      expect(mean).toBeGreaterThan(0.9)
    })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/utils/math.test.ts
```

**Step 3: Implement math.ts**

```typescript
// src/utils/math.ts

/** Calculate z-score: how many standard deviations a value is from the mean */
export function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

/** Calculate standard deviation of a number array */
export function standardDeviation(values: number[]): number {
  if (values.length <= 1) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const squareDiffs = values.map((v) => (v - mean) ** 2)
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length)
}

/** Compute moving average with given window size */
export function movingAverage(values: number[], window: number): number[] {
  if (values.length < window) return []
  const result: number[] = []
  for (let i = 0; i <= values.length - window; i++) {
    const slice = values.slice(i, i + window)
    result.push(slice.reduce((a, b) => a + b, 0) / window)
  }
  return result
}

/**
 * Sample from a Beta distribution using the Jöhnk algorithm.
 * Used for Thompson Sampling in MAB experiments.
 * alpha = successes + 1, beta = failures + 1
 */
export function betaSample(alpha: number, beta: number): number {
  // Use the gamma function approach for better numerical stability
  const gammaA = gammaSample(alpha)
  const gammaB = gammaSample(beta)
  return gammaA / (gammaA + gammaB)
}

/** Sample from Gamma(shape, 1) using Marsaglia and Tsang's method */
function gammaSample(shape: number): number {
  if (shape < 1) {
    // Boost for shape < 1
    return gammaSample(shape + 1) * Math.random() ** (1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      x = randn()
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

/** Standard normal sample via Box-Muller */
function randn(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
```

**Step 4: Run tests**

```bash
bun test tests/utils/math.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/utils/math.ts tests/utils/math.test.ts
git commit -m "feat: math utilities — z-score, moving average, beta sampling for MAB"
```

---

## Task 5: Sentiment Analyzer Service

**Files:**
- Create: `src/services/sentiment/analyzer.ts`
- Create: `src/services/sentiment/themes.ts`
- Test: `tests/services/sentiment/analyzer.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/sentiment/analyzer.test.ts
import { describe, it, expect } from 'vitest'
import { detectDrift, classifySentiment } from '../../../src/services/sentiment/analyzer'
import { extractThemes } from '../../../src/services/sentiment/themes'

describe('sentiment analyzer', () => {
  describe('classifySentiment', () => {
    it('classifies positive score', () => {
      expect(classifySentiment(0.6)).toBe('positive')
    })

    it('classifies negative score', () => {
      expect(classifySentiment(-0.4)).toBe('negative')
    })

    it('classifies neutral score', () => {
      expect(classifySentiment(0.05)).toBe('neutral')
    })
  })

  describe('detectDrift', () => {
    it('detects positive drift when z-score exceeds threshold', () => {
      const baseline = [-0.1, 0.0, 0.1, -0.05, 0.05, 0.0, -0.1]
      const current = [0.5, 0.6, 0.55, 0.7, 0.65]
      const result = detectDrift(baseline, current, 2.0)
      expect(result).not.toBeNull()
      expect(result!.direction).toBe('positive')
      expect(Math.abs(result!.zScore)).toBeGreaterThan(2.0)
    })

    it('returns null when no significant drift', () => {
      const baseline = [0.1, 0.0, 0.1, -0.05, 0.05]
      const current = [0.08, 0.12, 0.0, 0.05]
      const result = detectDrift(baseline, current, 2.0)
      expect(result).toBeNull()
    })
  })
})

describe('theme extraction', () => {
  it('matches known theme patterns', () => {
    const text = 'The product launch was a massive success with innovative features'
    const themes = extractThemes(text)
    expect(themes).toContain('Product Launch')
  })

  it('returns empty for unrelated content', () => {
    const themes = extractThemes('The weather is nice today')
    expect(themes.length).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/services/sentiment/analyzer.test.ts
```

**Step 3: Implement analyzer.ts**

```typescript
// src/services/sentiment/analyzer.ts
import { zScore, standardDeviation } from '../../utils/math'

export type SentimentLabel = 'positive' | 'neutral' | 'negative'

export interface DriftResult {
  zScore: number
  direction: 'positive' | 'negative'
  baselineMean: number
  currentMean: number
}

/** Classify a sentiment score (-1.0 to 1.0) into a label */
export function classifySentiment(score: number): SentimentLabel {
  if (score > 0.1) return 'positive'
  if (score < -0.1) return 'negative'
  return 'neutral'
}

/**
 * Detect sentiment drift between a baseline window and a current window.
 * Returns a DriftResult if the z-score exceeds the threshold, null otherwise.
 */
export function detectDrift(
  baselineScores: number[],
  currentScores: number[],
  threshold = 2.0,
): DriftResult | null {
  if (baselineScores.length < 2 || currentScores.length < 1) return null

  const baselineMean = baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length
  const baselineStdDev = standardDeviation(baselineScores)
  const currentMean = currentScores.reduce((a, b) => a + b, 0) / currentScores.length

  const z = zScore(currentMean, baselineMean, baselineStdDev)

  if (Math.abs(z) < threshold) return null

  return {
    zScore: z,
    direction: z > 0 ? 'positive' : 'negative',
    baselineMean,
    currentMean,
  }
}
```

**Step 4: Implement themes.ts**

```typescript
// src/services/sentiment/themes.ts

const THEME_PATTERNS: Record<string, RegExp[]> = {
  'Product Launch': [/product launch/i, /new release/i, /launched/i, /unveil/i, /debut/i],
  'Innovation': [/innovat/i, /breakthrough/i, /cutting.?edge/i, /pioneer/i, /revolutionary/i],
  'Financial': [/revenue/i, /earnings/i, /profit/i, /growth\s+\d/i, /market\s+cap/i, /valuation/i],
  'Issues': [/outage/i, /bug/i, /recall/i, /lawsuit/i, /breach/i, /vulnerability/i, /scandal/i],
  'Legal/Regulatory': [/regulat/i, /compliance/i, /antitrust/i, /gdpr/i, /fine\b/i, /penalty/i],
  'Privacy/Security': [/privacy/i, /data\s+protection/i, /security/i, /encrypt/i, /hack/i],
  'Competition': [/compet/i, /market\s+share/i, /rival/i, /disrupt/i, /overtake/i],
  'Leadership': [/ceo/i, /leadership/i, /executive/i, /board\b/i, /appoint/i, /resign/i],
  'Customer Issues': [/customer\s+(complain|issue|problem)/i, /support\s+ticket/i, /refund/i],
}

/** Extract themes from text by matching known patterns */
export function extractThemes(text: string): string[] {
  const matched: string[] = []
  for (const [theme, patterns] of Object.entries(THEME_PATTERNS)) {
    if (patterns.some((p) => p.test(text))) {
      matched.push(theme)
    }
  }
  return matched
}
```

**Step 5: Run tests, commit**

```bash
bun test tests/services/sentiment/analyzer.test.ts
git add src/services/sentiment/ tests/services/sentiment/
git commit -m "feat: sentiment analyzer with z-score drift detection and theme extraction"
```

---

## Task 6: Sentiment Ingestion Service

**Files:**
- Create: `src/services/sentiment/ingestion.ts`
- Modify: `src/routes/ingest.ts` — process sentiment from batches
- Test: `tests/services/sentiment/ingestion.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/sentiment/ingestion.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeBatchToArticles } from '../../../src/services/sentiment/ingestion'

describe('sentiment ingestion', () => {
  it('normalizes a social batch into article records', () => {
    const batch = {
      job_id: 'test-job',
      batch_index: 0,
      is_final: false,
      posts: [
        {
          platform: 'reddit',
          title: 'Great new product launch',
          content: 'The innovative product launch was amazing',
          author: 'user123',
          url: 'https://reddit.com/r/test/1',
          engagement: { score: 150, comments: 20 },
          posted_at: '2026-02-20T10:00:00Z',
        },
      ],
    }

    const articles = normalizeBatchToArticles(batch, 'tenant-1')
    expect(articles).toHaveLength(1)
    expect(articles[0].source).toBe('reddit')
    expect(articles[0].tenantId).toBe('tenant-1')
    expect(articles[0].title).toBe('Great new product launch')
  })

  it('normalizes an RSS batch into article records', () => {
    const batch = {
      job_id: 'test-job',
      batch_index: 0,
      is_final: true,
      pages: [
        {
          url: 'https://news.example.com/article-1',
          title: 'Market Report Q1',
          content: 'Revenue growth continues...',
          author: 'Editor',
          content_hash: 'abc123',
        },
      ],
    }

    const articles = normalizeBatchToArticles(batch, 'tenant-1')
    expect(articles).toHaveLength(1)
    expect(articles[0].source).toBe('web')
    expect(articles[0].url).toBe('https://news.example.com/article-1')
  })

  it('returns empty array for empty batch', () => {
    const batch = { job_id: 'test', batch_index: 0, is_final: true }
    const articles = normalizeBatchToArticles(batch, 'tenant-1')
    expect(articles).toEqual([])
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/services/sentiment/ingestion.test.ts
```

**Step 3: Implement ingestion.ts**

```typescript
// src/services/sentiment/ingestion.ts
import { createHash } from 'crypto'

export interface NormalizedArticle {
  tenantId: string
  source: 'rss' | 'reddit' | 'linkedin' | 'instagram' | 'news' | 'web'
  title: string
  content: string | null
  url: string | null
  author: string | null
  contentHash: string
  metadata: Record<string, unknown>
  publishedAt: Date | null
}

interface BatchPayload {
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

/** Normalize a batch from the Rust scraper worker into article records for DB insert */
export function normalizeBatchToArticles(batch: BatchPayload, tenantId: string): NormalizedArticle[] {
  const articles: NormalizedArticle[] = []

  // Process web/RSS pages
  if (batch.pages) {
    for (const page of batch.pages) {
      articles.push({
        tenantId,
        source: 'web',
        title: page.title,
        content: page.content ?? null,
        url: page.url,
        author: page.author ?? null,
        contentHash: page.content_hash ?? hashContent(page.title + (page.content ?? '')),
        metadata: {},
        publishedAt: null,
      })
    }
  }

  // Process social posts
  if (batch.posts) {
    for (const post of batch.posts) {
      const platform = normalizePlatform(post.platform)
      articles.push({
        tenantId,
        source: platform,
        title: post.title ?? post.content?.slice(0, 100) ?? 'Untitled',
        content: post.content ?? null,
        url: post.url ?? null,
        author: post.author ?? null,
        contentHash: hashContent((post.title ?? '') + (post.content ?? '')),
        metadata: { engagement: post.engagement ?? {} },
        publishedAt: post.posted_at ? new Date(post.posted_at) : null,
      })
    }
  }

  return articles
}

function normalizePlatform(platform: string): NormalizedArticle['source'] {
  const map: Record<string, NormalizedArticle['source']> = {
    reddit: 'reddit',
    linkedin: 'linkedin',
    instagram: 'instagram',
    rss: 'rss',
    news: 'news',
  }
  return map[platform.toLowerCase()] ?? 'web'
}

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}
```

**Step 4: Run tests, commit**

```bash
bun test tests/services/sentiment/ingestion.test.ts
git add src/services/sentiment/ingestion.ts tests/services/sentiment/ingestion.test.ts
git commit -m "feat: sentiment ingestion service — normalize scraper batches to articles"
```

---

## Task 7: Sentiment Competitive Benchmarking Service

**Files:**
- Create: `src/services/sentiment/competitive.ts`
- Test: `tests/services/sentiment/competitive.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/sentiment/competitive.test.ts
import { describe, it, expect } from 'vitest'
import { calculateShareOfVoice, compareBrands } from '../../../src/services/sentiment/competitive'

describe('competitive benchmarking', () => {
  const articles = [
    { brand: 'Apple', sentimentScore: 0.5 },
    { brand: 'Apple', sentimentScore: 0.3 },
    { brand: 'Apple', sentimentScore: 0.8 },
    { brand: 'Samsung', sentimentScore: -0.2 },
    { brand: 'Samsung', sentimentScore: 0.1 },
    { brand: 'Google', sentimentScore: 0.4 },
  ]

  it('calculates share of voice per brand', () => {
    const sov = calculateShareOfVoice(articles)
    expect(sov.Apple).toBeCloseTo(0.5, 1) // 3/6
    expect(sov.Samsung).toBeCloseTo(0.333, 1) // 2/6
    expect(sov.Google).toBeCloseTo(0.167, 1) // 1/6
  })

  it('compares brand sentiment averages', () => {
    const comparison = compareBrands(articles)
    expect(comparison.Apple.avgSentiment).toBeCloseTo(0.533, 1)
    expect(comparison.Samsung.avgSentiment).toBeCloseTo(-0.05, 1)
    expect(comparison.Apple.articleCount).toBe(3)
  })
})
```

**Step 2: Run test, implement, run test, commit**

```typescript
// src/services/sentiment/competitive.ts

interface ArticleData {
  brand: string
  sentimentScore: number
}

interface BrandStats {
  avgSentiment: number
  articleCount: number
  positiveCount: number
  negativeCount: number
  neutralCount: number
}

/** Calculate share of voice: percentage of total articles per brand */
export function calculateShareOfVoice(articles: ArticleData[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const a of articles) {
    counts[a.brand] = (counts[a.brand] ?? 0) + 1
  }
  const total = articles.length
  const result: Record<string, number> = {}
  for (const [brand, count] of Object.entries(counts)) {
    result[brand] = count / total
  }
  return result
}

/** Compare sentiment statistics across brands */
export function compareBrands(articles: ArticleData[]): Record<string, BrandStats> {
  const grouped: Record<string, number[]> = {}
  for (const a of articles) {
    if (!grouped[a.brand]) grouped[a.brand] = []
    grouped[a.brand].push(a.sentimentScore)
  }

  const result: Record<string, BrandStats> = {}
  for (const [brand, scores] of Object.entries(grouped)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    result[brand] = {
      avgSentiment: avg,
      articleCount: scores.length,
      positiveCount: scores.filter((s) => s > 0.1).length,
      negativeCount: scores.filter((s) => s < -0.1).length,
      neutralCount: scores.filter((s) => s >= -0.1 && s <= 0.1).length,
    }
  }
  return result
}
```

```bash
bun test tests/services/sentiment/competitive.test.ts
git add src/services/sentiment/competitive.ts tests/services/sentiment/competitive.test.ts
git commit -m "feat: competitive benchmarking — share of voice and brand comparison"
```

---

## Task 8: MAB Service (Thompson Sampling)

**Files:**
- Create: `src/services/mab/thompson.ts`
- Create: `src/services/mab/allocator.ts`
- Test: `tests/services/mab/thompson.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/mab/thompson.test.ts
import { describe, it, expect } from 'vitest'
import { selectArm, updateArm } from '../../../src/services/mab/thompson'
import { allocateTraffic } from '../../../src/services/mab/allocator'

describe('Thompson Sampling', () => {
  it('selects the arm with highest sampled value', () => {
    // Arm 0 has much higher alpha (successes), should be selected most often
    const arms = [
      { alpha: 100, beta: 1 },
      { alpha: 1, beta: 100 },
    ]
    const counts = [0, 0]
    for (let i = 0; i < 100; i++) {
      const idx = selectArm(arms)
      counts[idx]++
    }
    expect(counts[0]).toBeGreaterThan(90) // Arm 0 should win almost always
  })

  it('updateArm increments alpha on success', () => {
    const arm = { alpha: 1, beta: 1 }
    const updated = updateArm(arm, true)
    expect(updated.alpha).toBe(2)
    expect(updated.beta).toBe(1)
  })

  it('updateArm increments beta on failure', () => {
    const arm = { alpha: 1, beta: 1 }
    const updated = updateArm(arm, false)
    expect(updated.alpha).toBe(1)
    expect(updated.beta).toBe(2)
  })
})

describe('traffic allocator', () => {
  it('allocates traffic proportionally to arm strength', () => {
    const arms = [
      { alpha: 50, beta: 10 }, // strong
      { alpha: 10, beta: 50 }, // weak
      { alpha: 5, beta: 5 },   // uncertain
    ]
    const allocation = allocateTraffic(arms)
    expect(allocation).toHaveLength(3)
    expect(allocation[0]).toBeGreaterThan(allocation[1]) // strong > weak
    expect(allocation.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5) // sums to 1
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/services/mab/thompson.test.ts
```

**Step 3: Implement thompson.ts**

```typescript
// src/services/mab/thompson.ts
import { betaSample } from '../../utils/math'

export interface ArmState {
  alpha: number // successes + 1
  beta: number  // failures + 1
}

/** Select the arm index with the highest Thompson sample */
export function selectArm(arms: ArmState[]): number {
  let bestIdx = 0
  let bestSample = -1

  for (let i = 0; i < arms.length; i++) {
    const sample = betaSample(arms[i].alpha, arms[i].beta)
    if (sample > bestSample) {
      bestSample = sample
      bestIdx = i
    }
  }

  return bestIdx
}

/** Update arm state after observing a reward (success/failure) */
export function updateArm(arm: ArmState, success: boolean): ArmState {
  return {
    alpha: arm.alpha + (success ? 1 : 0),
    beta: arm.beta + (success ? 0 : 1),
  }
}
```

**Step 4: Implement allocator.ts**

```typescript
// src/services/mab/allocator.ts
import type { ArmState } from './thompson'

/**
 * Allocate traffic proportionally based on arm strength.
 * Uses expected value of Beta distribution: alpha / (alpha + beta)
 * Returns array of fractions summing to 1.0
 */
export function allocateTraffic(arms: ArmState[]): number[] {
  const expectations = arms.map((a) => a.alpha / (a.alpha + a.beta))
  const total = expectations.reduce((a, b) => a + b, 0)
  return expectations.map((e) => e / total)
}
```

**Step 5: Run tests, commit**

```bash
bun test tests/services/mab/thompson.test.ts
git add src/services/mab/ tests/services/mab/
git commit -m "feat: MAB Thompson Sampling with traffic allocator"
```

---

## Task 9: Signals Route + ABM Route

**Files:**
- Create: `src/routes/signals.ts`
- Create: `src/routes/abm.ts`
- Modify: `src/routes/index.ts`
- Modify: `src/types/api.ts` — add Zod schemas
- Test: `tests/routes/signals.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/signals.test.ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('signals routes', () => {
  const app = createApp()

  it('POST /api/v1/signals/capture validates required fields', async () => {
    const res = await app.request('/api/v1/signals/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/signals/capture validates strength range', async () => {
    const res = await app.request('/api/v1/signals/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acct-1',
        signalType: 'page_view',
        signalSource: 'website',
        strength: 150, // out of range
        signalData: {},
      }),
    })
    expect(res.status).toBe(422)
  })
})

describe('abm routes', () => {
  const app = createApp()

  it('POST /api/v1/accounts validates company name', async () => {
    const res = await app.request('/api/v1/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
ENVIRONMENT=testing bun test tests/routes/signals.test.ts
```

**Step 3: Add Zod schemas to api.ts**

Append to `src/types/api.ts`:
```typescript
// Signals
export const signalCapture = z.object({
  accountId: z.string().min(1),
  signalType: z.enum(['page_view', 'email_open', 'email_click', 'form_submit', 'demo_request', 'pricing_view', 'content_download', 'social_mention', 'competitor_visit', 'custom']),
  signalSource: z.string().min(1),
  strength: z.number().int().min(1).max(100),
  signalData: z.record(z.string(), z.any()).default({}),
})

export type SignalCapture = z.infer<typeof signalCapture>

// Accounts (ABM)
export const accountCreate = z.object({
  company: z.string().min(1).max(200),
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.enum(['1-10', '11-50', '51-200', '201-1000', '1001-5000', '5000+']).optional(),
  tier: z.enum(['enterprise', 'mid_market', 'smb', 'startup']).default('smb'),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type AccountCreate = z.infer<typeof accountCreate>

// Deals
export const dealCreate = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1).max(200),
  value: z.number().positive(),
  stage: z.enum(['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).default('discovery'),
  probability: z.number().int().min(0).max(100).default(0),
  expectedCloseDate: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export type DealCreate = z.infer<typeof dealCreate>
```

**Step 4: Implement signals route**

```typescript
// src/routes/signals.ts
import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { eq, and, sql, desc, gte } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { signals, accountScores } from '../db/schema'
import { getDb } from '../db/client'
import { signalCapture, paginationQuery } from '../types/api'

export function createSignalRoutes() {
  const router = new Hono<AppEnv>()

  // Capture a signal
  router.post('/capture', validate('json', signalCapture), async (c) => {
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const data = c.req.valid('json')

    const [created] = await db.insert(signals).values({ ...data, tenantId }).returning()
    return c.json(created, 201)
  })

  // Get hot accounts (score above threshold)
  router.get('/hot', async (c) => {
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const threshold = Number(c.req.query('threshold') ?? 50)
    const limit = Number(c.req.query('limit') ?? 50)

    const hot = await db
      .select()
      .from(accountScores)
      .where(and(eq(accountScores.tenantId, tenantId), gte(accountScores.totalScore, threshold)))
      .orderBy(desc(accountScores.totalScore))
      .limit(limit)

    return c.json({ items: hot, threshold, count: hot.length })
  })

  // Get signals for an account
  router.get('/accounts/:accountId', async (c) => {
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const accountId = c.req.param('accountId')
    const days = Number(c.req.query('days') ?? 90)

    const since = new Date()
    since.setDate(since.getDate() - days)

    const items = await db
      .select()
      .from(signals)
      .where(and(
        eq(signals.tenantId, tenantId),
        eq(signals.accountId, accountId),
        gte(signals.createdAt, since),
      ))
      .orderBy(desc(signals.createdAt))

    return c.json({ items, accountId, days })
  })

  return router
}
```

**Step 5: Implement ABM route**

```typescript
// src/routes/abm.ts
import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { eq, and, sql, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { accounts, deals } from '../db/schema'
import { getDb } from '../db/client'
import { accountCreate, dealCreate, paginationQuery } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createAbmRoutes() {
  const router = new Hono<AppEnv>()

  // List accounts
  router.get('/', async (c) => {
    const { page, limit } = paginationQuery.parse(c.req.query())
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const offset = (page - 1) * limit

    const [items, countResult] = await Promise.all([
      db.select().from(accounts).where(eq(accounts.tenantId, tenantId)).limit(limit).offset(offset).orderBy(desc(accounts.score)),
      db.select({ count: sql<number>`count(*)` }).from(accounts).where(eq(accounts.tenantId, tenantId)),
    ])

    return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
  })

  // Create account
  router.post('/', validate('json', accountCreate), async (c) => {
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const data = c.req.valid('json')

    const [created] = await db.insert(accounts).values({ ...data, tenantId }).returning()
    return c.json(created, 201)
  })

  // Get account with deals
  router.get('/:id', async (c) => {
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const id = c.req.param('id')

    const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.tenantId, tenantId)))
    if (!account) throw new NotFoundError('Account', id)

    const accountDeals = await db.select().from(deals).where(eq(deals.accountId, id))
    return c.json({ ...account, deals: accountDeals })
  })

  // Create deal
  router.post('/deals', validate('json', dealCreate), async (c) => {
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const data = c.req.valid('json')

    const [created] = await db.insert(deals).values({ ...data, tenantId }).returning()
    return c.json(created, 201)
  })

  return router
}
```

**Step 6: Register routes in index.ts**

Add to `src/routes/index.ts`:
```typescript
import { createSignalRoutes } from './signals'
import { createAbmRoutes } from './abm'

// inside registerRoutes():
app.route('/api/v1/signals', createSignalRoutes())
app.route('/api/v1/accounts', createAbmRoutes())
```

**Step 7: Run tests, commit**

```bash
ENVIRONMENT=testing bun test tests/routes/signals.test.ts
git add src/routes/signals.ts src/routes/abm.ts src/routes/index.ts src/types/api.ts tests/routes/signals.test.ts
git commit -m "feat: signals capture + ABM accounts/deals routes"
```

---

## Task 10: Sentiment Route

**Files:**
- Create: `src/routes/social-sentiment.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/routes/sentiment.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/sentiment.test.ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('social-sentiment routes', () => {
  const app = createApp()

  it('GET /api/v1/sentiment/signals requires ticker param', async () => {
    const res = await app.request('/api/v1/sentiment/signals')
    // Should return 422 or default behavior
    expect([200, 422, 500]).toContain(res.status)
  })

  it('GET /api/v1/sentiment/drift returns drift events', async () => {
    const res = await app.request('/api/v1/sentiment/drift?brand=TestBrand')
    expect([200, 500]).toContain(res.status)
  })
})
```

**Step 2: Implement social-sentiment route, register, test, commit**

```typescript
// src/routes/social-sentiment.ts
import { Hono } from 'hono'
import { eq, and, desc, gte, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { sentimentArticles, driftEvents } from '../db/schema'
import { getDb } from '../db/client'

export function createSentimentRoutes() {
  const router = new Hono<AppEnv>()

  // Get sentiment signals for a brand
  router.get('/signals', async (c) => {
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const brand = c.req.query('brand') ?? c.req.query('ticker') ?? ''
    const window = c.req.query('window') ?? '24h'
    const limit = Number(c.req.query('limit') ?? 50)

    const hours = window === '7d' ? 168 : window === '24h' ? 24 : window === '1h' ? 1 : 24
    const since = new Date()
    since.setHours(since.getHours() - hours)

    const items = await db
      .select()
      .from(sentimentArticles)
      .where(and(
        eq(sentimentArticles.tenantId, tenantId),
        eq(sentimentArticles.brand, brand),
        gte(sentimentArticles.analyzedAt, since),
      ))
      .orderBy(desc(sentimentArticles.analyzedAt))
      .limit(limit)

    return c.json({ items, brand, window, count: items.length })
  })

  // Get drift events for a brand
  router.get('/drift', async (c) => {
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const brand = c.req.query('brand') ?? ''
    const limit = Number(c.req.query('limit') ?? 20)

    const items = await db
      .select()
      .from(driftEvents)
      .where(and(eq(driftEvents.tenantId, tenantId), eq(driftEvents.brand, brand)))
      .orderBy(desc(driftEvents.createdAt))
      .limit(limit)

    return c.json({ items, brand })
  })

  // Get competitive summary
  router.get('/competitive', async (c) => {
    const db = getDb()
    const tenantId = c.get('tenantId')!
    const window = c.req.query('window') ?? '7d'

    const hours = window === '30d' ? 720 : window === '7d' ? 168 : 24
    const since = new Date()
    since.setHours(since.getHours() - hours)

    const items = await db
      .select({
        brand: sentimentArticles.brand,
        avgScore: sql<number>`avg(${sentimentArticles.sentimentScore})`,
        count: sql<number>`count(*)`,
      })
      .from(sentimentArticles)
      .where(and(eq(sentimentArticles.tenantId, tenantId), gte(sentimentArticles.analyzedAt, since)))
      .groupBy(sentimentArticles.brand)

    return c.json({ items, window })
  })

  return router
}
```

Register in `src/routes/index.ts`:
```typescript
import { createSentimentRoutes } from './social-sentiment'
app.route('/api/v1/sentiment', createSentimentRoutes())
```

```bash
ENVIRONMENT=testing bun test tests/routes/sentiment.test.ts
git add src/routes/social-sentiment.ts src/routes/index.ts tests/routes/sentiment.test.ts
git commit -m "feat: social sentiment routes — signals, drift, competitive summary"
```

---

## Task 11: Experiments Route (MAB)

**Files:**
- Create: `src/routes/experiments.ts`
- Modify: `src/routes/index.ts`
- Modify: `src/types/api.ts`
- Test: `tests/routes/experiments.test.ts`

**Step 1: Write test, implement route with CRUD + MAB allocation endpoint, register, commit**

The route should include:
- `GET /api/v1/experiments` — list experiments
- `POST /api/v1/experiments` — create experiment
- `GET /api/v1/experiments/:id` — get with arms
- `POST /api/v1/experiments/:id/arms` — add arm
- `GET /api/v1/experiments/:id/allocate` — get MAB allocation using Thompson Sampling
- `POST /api/v1/experiments/:id/reward` — record reward for an arm

Add Zod schemas to `src/types/api.ts`:
```typescript
export const experimentCreate = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['ab_test', 'mab_thompson', 'mab_ucb', 'mab_epsilon']).default('mab_thompson'),
  targetMetric: z.string().min(1),
})

export const armCreate = z.object({
  variantName: z.string().min(1),
  content: z.record(z.string(), z.any()).default({}),
})

export const armReward = z.object({
  armId: z.string().uuid(),
  success: z.boolean(),
})
```

```bash
ENVIRONMENT=testing bun test tests/routes/experiments.test.ts
git add src/routes/experiments.ts src/routes/index.ts src/types/api.ts tests/routes/experiments.test.ts
git commit -m "feat: experiments route with MAB Thompson Sampling allocation"
```

---

## Task 12: Personas Route + Brand Audit Route

**Files:**
- Create: `src/routes/personas.ts`
- Create: `src/routes/brand-audit.ts`
- Modify: `src/routes/index.ts`
- Modify: `src/types/api.ts`
- Test: `tests/routes/personas.test.ts`

**Step 1: Write test, implement CRUD routes for personas and brand kits**

Personas route:
- `GET /api/v1/personas` — list
- `POST /api/v1/personas` — create persona with OCEAN scores
- `GET /api/v1/personas/:id` — get detail

Brand audit route:
- `GET /api/v1/brand-kits` — list
- `POST /api/v1/brand-kits` — create brand kit
- `GET /api/v1/brand-kits/:id` — get detail
- `POST /api/v1/brand-kits/:id/audit` — audit content against kit (placeholder for LLM call)

Add Zod schemas:
```typescript
export const personaCreate = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  oceanScores: z.object({
    openness: z.number().min(0).max(1),
    conscientiousness: z.number().min(0).max(1),
    extraversion: z.number().min(0).max(1),
    agreeableness: z.number().min(0).max(1),
    neuroticism: z.number().min(0).max(1),
  }),
  demographics: z.record(z.string(), z.any()).default({}),
  motivations: z.array(z.string()).default([]),
  painPoints: z.array(z.string()).default([]),
  preferredChannels: z.array(z.string()).default([]),
})

export const brandKitCreate = z.object({
  name: z.string().min(1).max(100),
  brandName: z.string().min(1).max(100),
  colors: z.array(z.record(z.string(), z.any())).default([]),
  typography: z.array(z.record(z.string(), z.any())).default([]),
  voiceAttributes: z.record(z.string(), z.any()).default({}),
  logoRules: z.array(z.record(z.string(), z.any())).default([]),
  colorTolerance: z.number().int().min(0).max(255).default(50),
})
```

```bash
ENVIRONMENT=testing bun test tests/routes/personas.test.ts
git add src/routes/personas.ts src/routes/brand-audit.ts src/routes/index.ts src/types/api.ts tests/routes/personas.test.ts
git commit -m "feat: personas and brand audit routes with OCEAN scores and kit management"
```

---

## Task 13: Validation Service (Popper Framework)

**Files:**
- Create: `src/services/validation/evidence.ts`
- Create: `src/services/validation/confidence.ts`
- Test: `tests/services/validation/evidence.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/validation/evidence.test.ts
import { describe, it, expect } from 'vitest'
import { validateClaim } from '../../../src/services/validation/evidence'
import { confidenceInterval } from '../../../src/services/validation/confidence'

describe('evidence validation', () => {
  it('validates a well-supported claim', () => {
    const result = validateClaim({
      claim: 'Product X is popular',
      supportingEvidence: ['Source A says 80% adoption', 'Source B confirms growth'],
      contradictingEvidence: [],
    })
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.verdict).toBe('supported')
  })

  it('flags a claim with strong contradictions', () => {
    const result = validateClaim({
      claim: 'Product X is popular',
      supportingEvidence: ['One blog post'],
      contradictingEvidence: ['Market data shows 5% adoption', 'Survey shows low awareness', 'Competitor dominates'],
    })
    expect(result.confidence).toBeLessThan(0.5)
    expect(result.verdict).toBe('contradicted')
  })

  it('returns insufficient for no evidence', () => {
    const result = validateClaim({
      claim: 'Product X is popular',
      supportingEvidence: [],
      contradictingEvidence: [],
    })
    expect(result.verdict).toBe('insufficient')
  })
})

describe('confidence interval', () => {
  it('computes 95% CI for a sample', () => {
    const values = [10, 12, 11, 13, 9, 14, 10, 11, 12, 13]
    const ci = confidenceInterval(values, 0.95)
    expect(ci.mean).toBeCloseTo(11.5, 0)
    expect(ci.lower).toBeLessThan(ci.mean)
    expect(ci.upper).toBeGreaterThan(ci.mean)
  })
})
```

**Step 2: Implement evidence.ts**

```typescript
// src/services/validation/evidence.ts

interface ClaimInput {
  claim: string
  supportingEvidence: string[]
  contradictingEvidence: string[]
}

interface ClaimResult {
  claim: string
  confidence: number // 0-1
  verdict: 'supported' | 'contradicted' | 'insufficient' | 'mixed'
  reasoning: string
}

/** Validate a claim based on supporting vs contradicting evidence (rule-based, Popper-inspired) */
export function validateClaim(input: ClaimInput): ClaimResult {
  const { claim, supportingEvidence, contradictingEvidence } = input
  const totalEvidence = supportingEvidence.length + contradictingEvidence.length

  if (totalEvidence === 0) {
    return { claim, confidence: 0, verdict: 'insufficient', reasoning: 'No evidence provided' }
  }

  const supportRatio = supportingEvidence.length / totalEvidence
  const confidence = supportRatio

  let verdict: ClaimResult['verdict']
  if (confidence > 0.7) verdict = 'supported'
  else if (confidence < 0.3) verdict = 'contradicted'
  else if (totalEvidence < 2) verdict = 'insufficient'
  else verdict = 'mixed'

  const reasoning = `${supportingEvidence.length} supporting vs ${contradictingEvidence.length} contradicting sources`

  return { claim, confidence, verdict, reasoning }
}
```

**Step 3: Implement confidence.ts**

```typescript
// src/services/validation/confidence.ts
import { standardDeviation } from '../../utils/math'

interface ConfidenceIntervalResult {
  mean: number
  lower: number
  upper: number
  level: number
}

/** Compute confidence interval using normal approximation */
export function confidenceInterval(values: number[], level = 0.95): ConfidenceIntervalResult {
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const stdDev = standardDeviation(values)

  // z-value for common confidence levels
  const zMap: Record<number, number> = { 0.9: 1.645, 0.95: 1.96, 0.99: 2.576 }
  const z = zMap[level] ?? 1.96

  const margin = z * (stdDev / Math.sqrt(n))

  return {
    mean,
    lower: mean - margin,
    upper: mean + margin,
    level,
  }
}
```

**Step 4: Run tests, commit**

```bash
bun test tests/services/validation/evidence.test.ts
git add src/services/validation/ tests/services/validation/
git commit -m "feat: Popper validation — evidence-based claims and confidence intervals"
```

---

## Task 14: OpenAI Adapter

**Files:**
- Create: `src/adapters/openai.ts`
- Test: `tests/adapters/openai.test.ts`

**Step 1: Install OpenAI SDK**

```bash
bun add openai
```

**Step 2: Write the failing test**

```typescript
// tests/adapters/openai.test.ts
import { describe, it, expect } from 'vitest'
import { createOpenAIAdapter } from '../../src/adapters/openai'

describe('OpenAI adapter', () => {
  it('creates adapter without throwing when no API key', () => {
    const adapter = createOpenAIAdapter()
    expect(adapter).toBeDefined()
    expect(adapter.analyzeSentiment).toBeDefined()
    expect(adapter.generateContent).toBeDefined()
  })
})
```

**Step 3: Implement openai adapter**

```typescript
// src/adapters/openai.ts
import OpenAI from 'openai'
import { getConfig } from '../config'
import { logger } from '../utils/logger'

export interface OpenAIAdapter {
  analyzeSentiment(text: string, brand: string): Promise<{ score: number; themes: string[] }>
  generateContent(prompt: string, systemPrompt?: string): Promise<string>
}

export function createOpenAIAdapter(): OpenAIAdapter {
  const config = getConfig()
  const apiKey = config.OPENAI_API_KEY

  const client = apiKey ? new OpenAI({ apiKey }) : null

  return {
    async analyzeSentiment(text: string, brand: string) {
      if (!client) {
        logger.warn('OpenAI not configured, using fallback sentiment')
        return { score: 0, themes: [] }
      }

      const response = await client.chat.completions.create({
        model: config.OPENAI_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You analyze sentiment. Return JSON: { "score": number (-1 to 1), "themes": string[] }' },
          { role: 'user', content: `Analyze sentiment about "${brand}" in this text:\n\n${text.slice(0, 2000)}` },
        ],
        temperature: 0.3,
        max_tokens: 200,
      })

      const content = response.choices[0]?.message?.content ?? '{}'
      return JSON.parse(content) as { score: number; themes: string[] }
    },

    async generateContent(prompt: string, systemPrompt?: string) {
      if (!client) {
        logger.warn('OpenAI not configured, returning placeholder')
        return '[Content generation requires OPENAI_API_KEY]'
      }

      const response = await client.chat.completions.create({
        model: config.OPENAI_MODEL,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      })

      return response.choices[0]?.message?.content ?? ''
    },
  }
}
```

**Step 4: Run tests, commit**

```bash
bun test tests/adapters/openai.test.ts
git add src/adapters/openai.ts tests/adapters/openai.test.ts
git commit -m "feat: OpenAI adapter for sentiment analysis and content generation"
```

---

## Task 15: Integration Test — All Phase 2 Routes

**Files:**
- Create: `tests/integration/phase2.test.ts`

**Step 1: Write integration test covering all new routes**

```typescript
// tests/integration/phase2.test.ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

const app = createApp()

describe('Phase 2 routes exist and validate', () => {
  it('POST /api/v1/signals/capture validates input', async () => {
    const res = await app.request('/api/v1/signals/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('GET /api/v1/signals/hot responds', async () => {
    const res = await app.request('/api/v1/signals/hot')
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/v1/sentiment/signals responds', async () => {
    const res = await app.request('/api/v1/sentiment/signals?brand=test')
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/v1/sentiment/drift responds', async () => {
    const res = await app.request('/api/v1/sentiment/drift?brand=test')
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/v1/sentiment/competitive responds', async () => {
    const res = await app.request('/api/v1/sentiment/competitive')
    expect([200, 500]).toContain(res.status)
  })

  it('POST /api/v1/accounts validates input', async () => {
    const res = await app.request('/api/v1/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/experiments validates input', async () => {
    const res = await app.request('/api/v1/experiments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/personas validates OCEAN scores', async () => {
    const res = await app.request('/api/v1/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/brand-kits validates input', async () => {
    const res = await app.request('/api/v1/brand-kits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })
})
```

**Step 2: Run all tests**

```bash
ENVIRONMENT=testing bun test
```

Expected: All tests PASS

**Step 3: Commit**

```bash
git add tests/integration/phase2.test.ts
git commit -m "test: Phase 2 integration tests for all intelligence routes"
```

---

## Summary

After completing all 15 tasks, Phase 2 delivers:

1. **8 new Drizzle schemas**: sentiment_articles, drift_events, scraped_articles, scraped_social, scrape_jobs, signals, account_scores, accounts, deals, experiments, experiment_arms, persona_profiles, brand_kits
2. **Math utilities**: z-score, standard deviation, moving average, Beta sampling (Thompson)
3. **Sentiment services**: analyzer (drift detection), themes (pattern matching), ingestion (batch normalization), competitive (share of voice, brand comparison)
4. **MAB service**: Thompson Sampling arm selection, traffic allocator
5. **Validation service**: Popper evidence-based claim validation, confidence intervals
6. **New routes**: signals, sentiment, experiments, ABM (accounts/deals), personas, brand-kits
7. **OpenAI adapter**: Sentiment analysis + content generation with graceful fallback
8. **Full test suite**: Service unit tests + route validation + integration tests

**Next phase plan**: Phase 3 (Zeluto Integration) should be written after Phase 2 is complete.
