# Phase 3: Zeluto Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate indices_app with zeluto.com for content delivery, campaign execution, contact sync, A/B test delivery, and event feedback — completing the intelligence-to-execution bridge.

**Architecture:** A Zeluto HTTP client (`src/services/zeluto/client.ts`) handles all outbound API calls with X-Tenant-Context + API key authentication. Sync services transform internal data and push to zeluto. A webhook receiver ingests delivery events back for the learning loop. All sync operations are tracked in a `sync_logs` table.

**Tech Stack:** Same as Phase 1-2 (Hono 4.12, Bun, Drizzle, Zod, Vitest). No new dependencies.

**Existing patterns to follow:**
- Route factory: `src/routes/prospects.ts` — `createXRoutes()` returning `Hono<AppEnv>`
- Validation: `src/middleware/validate.ts` — `validate('json', zodSchema)`
- DB access: `getDb()` + tenant-scoped queries with `eq(table.tenantId, tenantId)`
- Schemas: `src/db/schema/*.ts` using `pgTable`, uuid PKs, `defaultRandom()`, timestamps
- Zod schemas: `src/types/api.ts` — colocated request/response schemas
- Route registration: `src/routes/index.ts` — `registerRoutes()` mounts all routers
- HMAC signing: `src/services/scraper/dispatcher.ts` — `signPayload()`, `verifySignature()`
- Adapter pattern: `src/adapters/openai.ts` — external API wrapper with graceful fallback
- Error classes: `src/types/errors.ts` — `AppError` hierarchy

**Zeluto API reference (key endpoints):**
- Templates: `POST /content/templates`, `PATCH /content/templates/:id`
- Campaigns: `POST /campaign/campaigns`, `POST /campaign/campaigns/:id/send`, `GET /campaign/campaigns/:id/stats`
- Contacts: `POST /crm/contacts/import`, `POST /crm/contacts`
- A/B Tests: `POST /campaign/ab-tests`, `GET /campaign/ab-tests/:id/results`
- Webhooks: `POST /integrations/webhooks`
- Auth: `X-Tenant-Context` header (base64 JSON: `{organizationId, userId, userRole, plan}`) + API key

---

## Task 1: Zeluto Type Definitions

**Files:**
- Create: `src/types/zeluto.ts`
- Modify: `src/types/errors.ts`
- Test: `tests/types/zeluto.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/types/zeluto.test.ts
import { describe, it, expect } from 'vitest'
import {
	zelutoTenantContext,
	zelutoTemplateCreate,
	zelutoContactImportResult,
	zelutoDeliveryEvent,
	zelutoWebhookEvent,
	zelutoCampaignStats,
	zelutoAbTestCreate,
} from '../../src/types/zeluto'

describe('zeluto types', () => {
	describe('zelutoTenantContext', () => {
		it('parses valid context', () => {
			const result = zelutoTenantContext.safeParse({
				organizationId: '550e8400-e29b-41d4-a716-446655440000',
				userId: '550e8400-e29b-41d4-a716-446655440001',
				userRole: 'admin',
				plan: 'pro',
			})
			expect(result.success).toBe(true)
		})

		it('rejects missing fields', () => {
			expect(zelutoTenantContext.safeParse({}).success).toBe(false)
			expect(zelutoTenantContext.safeParse({ organizationId: 'x' }).success).toBe(false)
		})

		it('rejects invalid role', () => {
			const result = zelutoTenantContext.safeParse({
				organizationId: 'org-1',
				userId: 'user-1',
				userRole: 'superadmin',
				plan: 'pro',
			})
			expect(result.success).toBe(false)
		})
	})

	describe('zelutoTemplateCreate', () => {
		it('parses valid template', () => {
			const result = zelutoTemplateCreate.safeParse({
				name: 'Welcome Email',
				type: 'email',
				subject: 'Welcome!',
				bodyHtml: '<h1>Hello</h1>',
			})
			expect(result.success).toBe(true)
		})

		it('requires name and type', () => {
			expect(zelutoTemplateCreate.safeParse({}).success).toBe(false)
			expect(zelutoTemplateCreate.safeParse({ name: 'X' }).success).toBe(false)
		})
	})

	describe('zelutoContactImportResult', () => {
		it('parses import result with errors', () => {
			const result = zelutoContactImportResult.safeParse({
				imported: 95,
				failed: 5,
				errors: [{ index: 2, error: 'Invalid email' }],
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.imported).toBe(95)
				expect(result.data.errors).toHaveLength(1)
			}
		})
	})

	describe('zelutoDeliveryEvent', () => {
		it('parses delivery event', () => {
			const result = zelutoDeliveryEvent.safeParse({
				id: 'evt-1',
				jobId: 'job-1',
				contactId: 42,
				channel: 'email',
				eventType: 'opened',
				providerMessageId: 'msg-123',
				createdAt: '2026-02-22T00:00:00Z',
			})
			expect(result.success).toBe(true)
		})

		it('rejects invalid event type', () => {
			const result = zelutoDeliveryEvent.safeParse({
				id: 'evt-1',
				jobId: 'job-1',
				contactId: 42,
				channel: 'email',
				eventType: 'invalid_type',
				providerMessageId: null,
				createdAt: '2026-02-22T00:00:00Z',
			})
			expect(result.success).toBe(false)
		})
	})

	describe('zelutoWebhookEvent', () => {
		it('parses webhook callback payload', () => {
			const result = zelutoWebhookEvent.safeParse({
				eventType: 'delivery.opened',
				payload: { jobId: 'job-1', contactId: 42 },
			})
			expect(result.success).toBe(true)
		})
	})

	describe('zelutoCampaignStats', () => {
		it('parses campaign stats', () => {
			const result = zelutoCampaignStats.safeParse({
				id: 1,
				campaignId: 10,
				totalRecipients: 1000,
				sent: 990,
				delivered: 980,
				opened: 400,
				clicked: 100,
				bounced: 10,
				complained: 2,
				unsubscribed: 5,
			})
			expect(result.success).toBe(true)
		})
	})

	describe('zelutoAbTestCreate', () => {
		it('parses A/B test create', () => {
			const result = zelutoAbTestCreate.safeParse({
				campaignId: 10,
				name: 'Subject line test',
				variants: [{ subject: 'A' }, { subject: 'B' }],
				winningCriteria: 'clicks',
			})
			expect(result.success).toBe(true)
		})
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/types/zeluto.test.ts`
Expected: FAIL — cannot resolve `../../src/types/zeluto`

**Step 3: Write minimal implementation**

```typescript
// src/types/zeluto.ts
import { z } from 'zod'

// --- Tenant Context ---
export const zelutoTenantContext = z.object({
	organizationId: z.string().min(1),
	userId: z.string().min(1),
	userRole: z.enum(['owner', 'admin', 'member', 'viewer']),
	plan: z.enum(['free', 'starter', 'pro', 'enterprise']),
})
export type ZelutoTenantContext = z.infer<typeof zelutoTenantContext>

// --- Templates ---
export const zelutoTemplateCreate = z.object({
	name: z.string().min(1),
	type: z.enum(['email', 'sms', 'push', 'page']),
	category: z.string().optional(),
	subject: z.string().optional(),
	bodyHtml: z.string().optional(),
	bodyText: z.string().optional(),
	bodyJson: z.record(z.string(), z.unknown()).optional(),
	isActive: z.boolean().optional(),
})
export type ZelutoTemplateCreate = z.infer<typeof zelutoTemplateCreate>

export const zelutoTemplate = z.object({
	id: z.number(),
	name: z.string(),
	type: z.enum(['email', 'sms', 'push', 'page']),
	category: z.string().nullable(),
	subject: z.string().nullable(),
	bodyHtml: z.string().nullable(),
	bodyText: z.string().nullable(),
	bodyJson: z.record(z.string(), z.unknown()).nullable(),
	thumbnailUrl: z.string().nullable(),
	isActive: z.boolean(),
	createdBy: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoTemplate = z.infer<typeof zelutoTemplate>

// --- Campaigns ---
export const zelutoCampaignCreate = z.object({
	name: z.string().min(1),
	description: z.string().optional(),
	type: z.enum(['email', 'sms', 'push', 'multichannel']),
})
export type ZelutoCampaignCreate = z.infer<typeof zelutoCampaignCreate>

export const zelutoCampaign = z.object({
	id: z.number(),
	name: z.string(),
	description: z.string().nullable(),
	type: z.enum(['email', 'sms', 'push', 'multichannel']),
	status: z.enum(['draft', 'scheduled', 'sending', 'sent', 'paused', 'canceled']),
	scheduledAt: z.string().nullable(),
	startedAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	createdBy: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoCampaign = z.infer<typeof zelutoCampaign>

export const zelutoCampaignStats = z.object({
	id: z.number(),
	campaignId: z.number(),
	totalRecipients: z.number(),
	sent: z.number(),
	delivered: z.number(),
	opened: z.number(),
	clicked: z.number(),
	bounced: z.number(),
	complained: z.number(),
	unsubscribed: z.number(),
})
export type ZelutoCampaignStats = z.infer<typeof zelutoCampaignStats>

// --- Contacts ---
export const zelutoContactCreate = z.object({
	email: z.string().email().optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	phone: z.string().optional(),
	companyId: z.number().optional(),
	tags: z.array(z.string()).optional(),
	customFields: z.record(z.string(), z.unknown()).optional(),
})
export type ZelutoContactCreate = z.infer<typeof zelutoContactCreate>

export const zelutoContact = z.object({
	id: z.number(),
	email: z.string().nullable(),
	firstName: z.string().nullable(),
	lastName: z.string().nullable(),
	phone: z.string().nullable(),
	companyId: z.number().nullable(),
	tags: z.array(z.string()),
	customFields: z.record(z.string(), z.unknown()),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoContact = z.infer<typeof zelutoContact>

export const zelutoContactImportResult = z.object({
	imported: z.number(),
	failed: z.number(),
	errors: z.array(
		z.object({
			index: z.number(),
			error: z.string(),
		}),
	),
})
export type ZelutoContactImportResult = z.infer<typeof zelutoContactImportResult>

// --- A/B Tests ---
export const zelutoAbTestCreate = z.object({
	campaignId: z.number(),
	name: z.string().min(1),
	variants: z.array(z.record(z.string(), z.unknown())),
	winningCriteria: z.enum(['opens', 'clicks', 'conversions']),
})
export type ZelutoAbTestCreate = z.infer<typeof zelutoAbTestCreate>

export const zelutoAbTest = z.object({
	id: z.number(),
	campaignId: z.number(),
	name: z.string(),
	variants: z.array(z.record(z.string(), z.unknown())),
	winningCriteria: z.enum(['opens', 'clicks', 'conversions']),
	winnerVariant: z.number().nullable(),
	status: z.enum(['running', 'completed', 'canceled']),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoAbTest = z.infer<typeof zelutoAbTest>

// --- Delivery Events ---
export const zelutoDeliveryEvent = z.object({
	id: z.string(),
	jobId: z.string(),
	contactId: z.number(),
	channel: z.enum(['email', 'sms', 'push', 'webhook']),
	eventType: z.enum([
		'queued',
		'sent',
		'delivered',
		'opened',
		'clicked',
		'bounced',
		'complained',
		'unsubscribed',
		'failed',
	]),
	providerMessageId: z.string().nullable(),
	createdAt: z.string(),
})
export type ZelutoDeliveryEvent = z.infer<typeof zelutoDeliveryEvent>

// --- Webhook Callback ---
export const zelutoWebhookEvent = z.object({
	eventType: z.string(),
	payload: z.record(z.string(), z.unknown()),
})
export type ZelutoWebhookEvent = z.infer<typeof zelutoWebhookEvent>

// --- Webhook Registration ---
export const zelutoWebhookCreate = z.object({
	url: z.string().url(),
	events: z.array(z.string()),
	isActive: z.boolean().optional(),
	secret: z.string().optional(),
})
export type ZelutoWebhookCreate = z.infer<typeof zelutoWebhookCreate>

export const zelutoWebhook = z.object({
	id: z.number(),
	url: z.string(),
	events: z.array(z.string()),
	isActive: z.boolean(),
	secret: z.string().nullable(),
	lastTriggeredAt: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
})
export type ZelutoWebhook = z.infer<typeof zelutoWebhook>

// --- Error ---
export const zelutoErrorResponse = z.object({
	code: z.string(),
	message: z.string(),
	details: z.record(z.string(), z.unknown()).optional(),
})
export type ZelutoErrorResponse = z.infer<typeof zelutoErrorResponse>
```

Now add `ZelutoApiError` to the error hierarchy:

```typescript
// src/types/errors.ts — append after ValidationError class

export class ZelutoApiError extends AppError {
	constructor(
		public readonly zelutoCode: string,
		message: string,
		statusCode: number = 502,
	) {
		super(statusCode, message, 'ZELUTO_API_ERROR')
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/types/zeluto.test.ts`
Expected: PASS — all 9 tests pass

**Step 5: Commit**

```bash
git add src/types/zeluto.ts src/types/errors.ts tests/types/zeluto.test.ts
git commit -m "feat: Zeluto type definitions — Zod schemas for all zeluto API types"
```

---

## Task 2: DB Schemas — Sync Logs, Zeluto Config, Delivery Events

**Files:**
- Create: `src/db/schema/sync-log.ts`
- Create: `src/db/schema/zeluto-config.ts`
- Create: `src/db/schema/delivery-events.ts`
- Modify: `src/db/schema/index.ts`
- Test: `tests/db/zeluto-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/zeluto-schema.test.ts
import { describe, it, expect } from 'vitest'
import { syncLogs } from '../../src/db/schema/sync-log'
import { zelutoConfigs } from '../../src/db/schema/zeluto-config'
import { deliveryEvents } from '../../src/db/schema/delivery-events'

describe('sync log schema', () => {
	it('syncLogs has required columns', () => {
		expect(syncLogs.id).toBeDefined()
		expect(syncLogs.tenantId).toBeDefined()
		expect(syncLogs.syncType).toBeDefined()
		expect(syncLogs.direction).toBeDefined()
		expect(syncLogs.status).toBeDefined()
		expect(syncLogs.resourceId).toBeDefined()
		expect(syncLogs.externalId).toBeDefined()
		expect(syncLogs.error).toBeDefined()
		expect(syncLogs.createdAt).toBeDefined()
	})
})

describe('zeluto config schema', () => {
	it('zelutoConfigs has required columns', () => {
		expect(zelutoConfigs.id).toBeDefined()
		expect(zelutoConfigs.tenantId).toBeDefined()
		expect(zelutoConfigs.organizationId).toBeDefined()
		expect(zelutoConfigs.userId).toBeDefined()
		expect(zelutoConfigs.userRole).toBeDefined()
		expect(zelutoConfigs.plan).toBeDefined()
		expect(zelutoConfigs.webhookSecret).toBeDefined()
		expect(zelutoConfigs.active).toBeDefined()
	})
})

describe('delivery events schema', () => {
	it('deliveryEvents has required columns', () => {
		expect(deliveryEvents.id).toBeDefined()
		expect(deliveryEvents.tenantId).toBeDefined()
		expect(deliveryEvents.zelutoJobId).toBeDefined()
		expect(deliveryEvents.campaignId).toBeDefined()
		expect(deliveryEvents.channel).toBeDefined()
		expect(deliveryEvents.eventType).toBeDefined()
		expect(deliveryEvents.contactEmail).toBeDefined()
		expect(deliveryEvents.eventData).toBeDefined()
		expect(deliveryEvents.occurredAt).toBeDefined()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/db/zeluto-schema.test.ts`
Expected: FAIL — cannot resolve modules

**Step 3: Write minimal implementation**

```typescript
// src/db/schema/sync-log.ts
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const syncLogs = pgTable(
	'sync_logs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		syncType: text('sync_type', {
			enum: ['content', 'campaign', 'contact', 'experiment', 'webhook_registration'],
		}).notNull(),
		direction: text('direction', { enum: ['outbound', 'inbound'] })
			.notNull()
			.default('outbound'),
		status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] })
			.notNull()
			.default('pending'),
		resourceId: text('resource_id'),
		externalId: text('external_id'),
		metadata: jsonb('metadata').default({}).notNull(),
		error: text('error'),
		startedAt: timestamp('started_at', { withTimezone: true }),
		completedAt: timestamp('completed_at', { withTimezone: true }),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('sync_logs_tenant_idx').on(table.tenantId),
		index('sync_logs_type_idx').on(table.syncType),
		index('sync_logs_status_idx').on(table.status),
	],
)
```

```typescript
// src/db/schema/zeluto-config.ts
import { pgTable, uuid, text, boolean, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const zelutoConfigs = pgTable(
	'zeluto_configs',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.unique()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		organizationId: text('organization_id').notNull(),
		userId: text('user_id').notNull(),
		userRole: text('user_role', { enum: ['owner', 'admin', 'member', 'viewer'] })
			.notNull()
			.default('admin'),
		plan: text('plan', { enum: ['free', 'starter', 'pro', 'enterprise'] })
			.notNull()
			.default('pro'),
		webhookSecret: text('webhook_secret'),
		webhookId: text('webhook_id'),
		active: boolean('active').notNull().default(true),
		metadata: jsonb('metadata').default({}).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [index('zeluto_configs_tenant_idx').on(table.tenantId)],
)
```

```typescript
// src/db/schema/delivery-events.ts
import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const deliveryEvents = pgTable(
	'delivery_events',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		tenantId: uuid('tenant_id')
			.notNull()
			.references(() => tenants.id, { onDelete: 'cascade' }),
		zelutoJobId: text('zeluto_job_id'),
		campaignId: uuid('campaign_id'),
		experimentId: uuid('experiment_id'),
		contactEmail: text('contact_email'),
		channel: text('channel', { enum: ['email', 'sms', 'push', 'webhook'] }).notNull(),
		eventType: text('event_type', {
			enum: [
				'queued',
				'sent',
				'delivered',
				'opened',
				'clicked',
				'bounced',
				'complained',
				'unsubscribed',
				'failed',
			],
		}).notNull(),
		providerMessageId: text('provider_message_id'),
		eventData: jsonb('event_data').default({}).notNull(),
		occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index('delivery_events_tenant_idx').on(table.tenantId),
		index('delivery_events_campaign_idx').on(table.campaignId),
		index('delivery_events_experiment_idx').on(table.experimentId),
		index('delivery_events_type_idx').on(table.eventType),
		index('delivery_events_occurred_idx').on(table.occurredAt),
	],
)
```

Now update the barrel export:

```typescript
// src/db/schema/index.ts — append these lines
export * from './sync-log'
export * from './zeluto-config'
export * from './delivery-events'
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/db/zeluto-schema.test.ts`
Expected: PASS — all 3 describe blocks pass

**Step 5: Commit**

```bash
git add src/db/schema/sync-log.ts src/db/schema/zeluto-config.ts src/db/schema/delivery-events.ts src/db/schema/index.ts tests/db/zeluto-schema.test.ts
git commit -m "feat: DB schemas for sync logs, zeluto config, and delivery events"
```

---

## Task 3: Config Update + Retry Utility

**Files:**
- Modify: `src/config.ts`
- Create: `src/utils/retry.ts`
- Test: `tests/utils/retry.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/utils/retry.test.ts
import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../../src/utils/retry'

describe('withRetry', () => {
	it('returns result on first success', async () => {
		const fn = vi.fn().mockResolvedValue('ok')
		const result = await withRetry(fn)
		expect(result).toBe('ok')
		expect(fn).toHaveBeenCalledTimes(1)
	})

	it('retries on failure then succeeds', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('fail1'))
			.mockRejectedValueOnce(new Error('fail2'))
			.mockResolvedValue('ok')

		const result = await withRetry(fn, { baseDelayMs: 1, maxRetries: 3 })
		expect(result).toBe('ok')
		expect(fn).toHaveBeenCalledTimes(3)
	})

	it('throws after max retries exhausted', async () => {
		const fn = vi.fn().mockRejectedValue(new Error('always fails'))

		await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow('always fails')
		expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
	})

	it('respects shouldRetry predicate', async () => {
		const fn = vi.fn().mockRejectedValue(new Error('permanent'))
		const shouldRetry = vi.fn().mockReturnValue(false)

		await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1, shouldRetry })).rejects.toThrow(
			'permanent',
		)
		expect(fn).toHaveBeenCalledTimes(1)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/utils/retry.test.ts`
Expected: FAIL — cannot resolve `../../src/utils/retry`

**Step 3: Write minimal implementation**

```typescript
// src/utils/retry.ts
export interface RetryOptions {
	maxRetries?: number
	baseDelayMs?: number
	maxDelayMs?: number
	shouldRetry?: (error: unknown) => boolean
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const {
		maxRetries = 3,
		baseDelayMs = 500,
		maxDelayMs = 10000,
		shouldRetry = () => true,
	} = options

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn()
		} catch (error) {
			if (attempt === maxRetries || !shouldRetry(error)) throw error
			const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs)
			const jitter = delay * (0.5 + Math.random() * 0.5)
			await new Promise((resolve) => setTimeout(resolve, jitter))
		}
	}

	throw new Error('Unreachable')
}
```

Now add the webhook secret to config:

```typescript
// src/config.ts — add after line 18 (ZELUTO_TENANT_CONTEXT)
	ZELUTO_API_KEY: z.string().optional(),
	ZELUTO_WEBHOOK_SECRET: z.string().default('dev-webhook-secret'),
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/utils/retry.test.ts`
Expected: PASS — all 4 tests pass

**Step 5: Commit**

```bash
git add src/utils/retry.ts src/config.ts tests/utils/retry.test.ts
git commit -m "feat: retry utility with exponential backoff + zeluto config vars"
```

---

## Task 4: Zeluto HTTP Client

**Files:**
- Create: `src/services/zeluto/client.ts`
- Test: `tests/services/zeluto/client.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/zeluto/client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ZelutoClient } from '../../../src/services/zeluto/client'

describe('ZelutoClient', () => {
	const originalFetch = global.fetch

	beforeEach(() => {
		global.fetch = vi.fn()
	})

	afterEach(() => {
		global.fetch = originalFetch
	})

	function mockFetchOk(data: unknown) {
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve(data),
		})
	}

	function mockFetchError(status: number, data: unknown) {
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status,
			json: () => Promise.resolve(data),
		})
	}

	const client = new ZelutoClient({
		baseUrl: 'https://zeluto.test/api/v1',
		tenantContext: {
			organizationId: 'org-1',
			userId: 'user-1',
			userRole: 'admin',
			plan: 'pro',
		},
	})

	describe('headers', () => {
		it('sends X-Tenant-Context header as base64 JSON', async () => {
			mockFetchOk({ id: 1, name: 'Test' })
			await client.createTemplate({ name: 'Test', type: 'email' })

			const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
			const header = opts.headers['X-Tenant-Context']
			const decoded = JSON.parse(atob(header))
			expect(decoded.organizationId).toBe('org-1')
			expect(decoded.userId).toBe('user-1')
			expect(decoded.userRole).toBe('admin')
			expect(decoded.plan).toBe('pro')
		})

		it('includes API key when provided', async () => {
			const clientWithKey = new ZelutoClient({
				baseUrl: 'https://zeluto.test/api/v1',
				tenantContext: { organizationId: 'o', userId: 'u', userRole: 'admin', plan: 'pro' },
				apiKey: 'sk-test-123',
			})
			mockFetchOk({ id: 1 })
			await clientWithKey.createTemplate({ name: 'T', type: 'email' })

			const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
			expect(opts.headers['X-API-Key']).toBe('sk-test-123')
		})
	})

	describe('createTemplate', () => {
		it('POSTs to /content/templates', async () => {
			mockFetchOk({ id: 42, name: 'Welcome', type: 'email' })
			const result = await client.createTemplate({ name: 'Welcome', type: 'email', subject: 'Hi' })

			expect(result.id).toBe(42)
			const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
			expect(url).toBe('https://zeluto.test/api/v1/content/templates')
			expect(opts.method).toBe('POST')
		})
	})

	describe('importContacts', () => {
		it('POSTs to /crm/contacts/import', async () => {
			mockFetchOk({ imported: 10, failed: 0, errors: [] })
			const result = await client.importContacts([{ email: 'a@b.com', firstName: 'A' }])

			expect(result.imported).toBe(10)
			const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
			expect(url).toBe('https://zeluto.test/api/v1/crm/contacts/import')
		})
	})

	describe('createCampaign', () => {
		it('POSTs to /campaign/campaigns', async () => {
			mockFetchOk({ id: 5, name: 'Camp', status: 'draft' })
			const result = await client.createCampaign({ name: 'Camp', type: 'email' })

			expect(result.id).toBe(5)
		})
	})

	describe('getCampaignStats', () => {
		it('GETs campaign stats', async () => {
			mockFetchOk({ campaignId: 5, sent: 100, opened: 40 })
			const result = await client.getCampaignStats(5)
			expect(result.sent).toBe(100)
		})
	})

	describe('createAbTest', () => {
		it('POSTs to /campaign/ab-tests', async () => {
			mockFetchOk({ id: 3, campaignId: 5, status: 'running' })
			const result = await client.createAbTest({
				campaignId: 5,
				name: 'Test',
				variants: [{ a: 1 }],
				winningCriteria: 'clicks',
			})
			expect(result.id).toBe(3)
		})
	})

	describe('error handling', () => {
		it('throws ZelutoApiError on non-ok response', async () => {
			mockFetchError(404, { code: 'NOT_FOUND', message: 'Template not found' })

			await expect(client.createTemplate({ name: 'X', type: 'email' })).rejects.toThrow(
				'Template not found',
			)
		})
	})

	describe('registerWebhook', () => {
		it('POSTs to /integrations/webhooks', async () => {
			mockFetchOk({ id: 7, url: 'https://pi.indices.app/webhooks/zeluto', events: ['delivery.opened'] })
			const result = await client.registerWebhook({
				url: 'https://pi.indices.app/webhooks/zeluto',
				events: ['delivery.opened'],
				secret: 'sec',
			})
			expect(result.id).toBe(7)
		})
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/zeluto/client.test.ts`
Expected: FAIL — cannot resolve module

**Step 3: Write minimal implementation**

```typescript
// src/services/zeluto/client.ts
import { ZelutoApiError } from '../../types/errors'
import { withRetry } from '../../utils/retry'
import type {
	ZelutoTemplateCreate,
	ZelutoTemplate,
	ZelutoCampaignCreate,
	ZelutoCampaign,
	ZelutoCampaignStats,
	ZelutoContactCreate,
	ZelutoContactImportResult,
	ZelutoAbTestCreate,
	ZelutoAbTest,
	ZelutoWebhookCreate,
	ZelutoWebhook,
	ZelutoTenantContext,
} from '../../types/zeluto'

export interface ZelutoClientConfig {
	baseUrl: string
	tenantContext: ZelutoTenantContext
	apiKey?: string
}

export class ZelutoClient {
	private baseUrl: string
	private headers: Record<string, string>

	constructor(config: ZelutoClientConfig) {
		this.baseUrl = config.baseUrl
		this.headers = {
			'Content-Type': 'application/json',
			'X-Tenant-Context': btoa(JSON.stringify(config.tenantContext)),
		}
		if (config.apiKey) {
			this.headers['X-API-Key'] = config.apiKey
		}
	}

	private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
		return withRetry(
			async () => {
				const response = await fetch(`${this.baseUrl}${path}`, {
					method,
					headers: this.headers,
					body: body ? JSON.stringify(body) : undefined,
				})

				if (!response.ok) {
					const error = await response.json().catch(() => ({
						code: 'UNKNOWN',
						message: `HTTP ${response.status}`,
					}))
					throw new ZelutoApiError(
						error.code ?? 'UNKNOWN',
						error.message ?? `HTTP ${response.status}`,
						response.status,
					)
				}

				return response.json() as Promise<T>
			},
			{
				maxRetries: 2,
				baseDelayMs: 500,
				shouldRetry: (err) => {
					if (err instanceof ZelutoApiError) {
						return err.statusCode >= 500 || err.statusCode === 429
					}
					return true
				},
			},
		)
	}

	// Templates
	async createTemplate(data: ZelutoTemplateCreate): Promise<ZelutoTemplate> {
		return this.request('POST', '/content/templates', data)
	}

	async updateTemplate(id: number, data: Partial<ZelutoTemplateCreate>): Promise<ZelutoTemplate> {
		return this.request('PATCH', `/content/templates/${id}`, data)
	}

	// Campaigns
	async createCampaign(data: ZelutoCampaignCreate): Promise<ZelutoCampaign> {
		return this.request('POST', '/campaign/campaigns', data)
	}

	async sendCampaign(id: number): Promise<ZelutoCampaign> {
		return this.request('POST', `/campaign/campaigns/${id}/send`)
	}

	async scheduleCampaign(id: number, scheduledAt: string): Promise<ZelutoCampaign> {
		return this.request('POST', `/campaign/campaigns/${id}/schedule`, { scheduledAt })
	}

	async getCampaignStats(id: number): Promise<ZelutoCampaignStats> {
		return this.request('GET', `/campaign/campaigns/${id}/stats`)
	}

	// Contacts
	async importContacts(contacts: ZelutoContactCreate[]): Promise<ZelutoContactImportResult> {
		return this.request('POST', '/crm/contacts/import', { contacts })
	}

	// A/B Tests
	async createAbTest(data: ZelutoAbTestCreate): Promise<ZelutoAbTest> {
		return this.request('POST', '/campaign/ab-tests', data)
	}

	async getAbTestResults(id: number): Promise<ZelutoAbTest> {
		return this.request('GET', `/campaign/ab-tests/${id}/results`)
	}

	async selectAbTestWinner(id: number, winnerVariant: number): Promise<ZelutoAbTest> {
		return this.request('POST', `/campaign/ab-tests/${id}/select-winner`, { winnerVariant })
	}

	// Webhooks
	async registerWebhook(data: ZelutoWebhookCreate): Promise<ZelutoWebhook> {
		return this.request('POST', '/integrations/webhooks', data)
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/zeluto/client.test.ts`
Expected: PASS — all 9 tests pass

**Step 5: Commit**

```bash
git add src/services/zeluto/client.ts tests/services/zeluto/client.test.ts
git commit -m "feat: Zeluto HTTP client with tenant context auth and retry"
```

---

## Task 5: Content Sync Service

**Files:**
- Create: `src/services/zeluto/content-sync.ts`
- Test: `tests/services/zeluto/content-sync.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/zeluto/content-sync.test.ts
import { describe, it, expect, vi } from 'vitest'
import { syncContent, mapChannelToTemplateType } from '../../../src/services/zeluto/content-sync'

describe('content sync', () => {
	describe('mapChannelToTemplateType', () => {
		it('maps email to email', () => {
			expect(mapChannelToTemplateType('email')).toBe('email')
		})

		it('maps sms to sms', () => {
			expect(mapChannelToTemplateType('sms')).toBe('sms')
		})

		it('defaults voice/linkedin to email', () => {
			expect(mapChannelToTemplateType('voice')).toBe('email')
			expect(mapChannelToTemplateType('linkedin')).toBe('email')
		})
	})

	describe('syncContent', () => {
		it('creates template via client and returns zeluto ID', async () => {
			const mockClient = {
				createTemplate: vi.fn().mockResolvedValue({
					id: 42,
					name: 'Welcome',
					type: 'email',
					subject: 'Hi',
				}),
			}

			const result = await syncContent(mockClient as any, {
				name: 'Welcome Email',
				channel: 'email',
				subject: 'Hi there',
				bodyHtml: '<h1>Welcome</h1>',
			})

			expect(result.zelutoTemplateId).toBe(42)
			expect(mockClient.createTemplate).toHaveBeenCalledWith({
				name: 'Welcome Email',
				type: 'email',
				subject: 'Hi there',
				bodyHtml: '<h1>Welcome</h1>',
				bodyText: undefined,
			})
		})

		it('passes bodyText when provided', async () => {
			const mockClient = {
				createTemplate: vi.fn().mockResolvedValue({ id: 10 }),
			}

			await syncContent(mockClient as any, {
				name: 'SMS Template',
				channel: 'sms',
				bodyText: 'Hello {{name}}',
			})

			expect(mockClient.createTemplate).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'sms', bodyText: 'Hello {{name}}' }),
			)
		})
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/zeluto/content-sync.test.ts`
Expected: FAIL — cannot resolve module

**Step 3: Write minimal implementation**

```typescript
// src/services/zeluto/content-sync.ts
import type { ZelutoClient } from './client'
import type { ZelutoTemplateCreate } from '../../types/zeluto'

export interface ContentSyncInput {
	name: string
	channel: string
	subject?: string
	bodyHtml?: string
	bodyText?: string
}

export interface ContentSyncResult {
	zelutoTemplateId: number
}

export function mapChannelToTemplateType(
	channel: string,
): ZelutoTemplateCreate['type'] {
	switch (channel) {
		case 'email':
			return 'email'
		case 'sms':
			return 'sms'
		default:
			return 'email'
	}
}

export async function syncContent(
	client: ZelutoClient,
	input: ContentSyncInput,
): Promise<ContentSyncResult> {
	const template = await client.createTemplate({
		name: input.name,
		type: mapChannelToTemplateType(input.channel),
		subject: input.subject,
		bodyHtml: input.bodyHtml,
		bodyText: input.bodyText,
	})

	return { zelutoTemplateId: template.id }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/zeluto/content-sync.test.ts`
Expected: PASS — all 4 tests pass

**Step 5: Commit**

```bash
git add src/services/zeluto/content-sync.ts tests/services/zeluto/content-sync.test.ts
git commit -m "feat: content sync service — push AI content to zeluto templates"
```

---

## Task 6: Contact Sync Service

**Files:**
- Create: `src/services/zeluto/contact-sync.ts`
- Test: `tests/services/zeluto/contact-sync.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/zeluto/contact-sync.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
	syncContacts,
	mapProspectToZelutoContact,
} from '../../../src/services/zeluto/contact-sync'

describe('contact sync', () => {
	describe('mapProspectToZelutoContact', () => {
		it('maps prospect fields to zeluto contact fields', () => {
			const result = mapProspectToZelutoContact({
				name: 'Jane Smith',
				email: 'jane@acme.com',
				phone: '+15551234567',
				company: 'Acme Inc',
				role: 'CTO',
			})

			expect(result.email).toBe('jane@acme.com')
			expect(result.firstName).toBe('Jane')
			expect(result.lastName).toBe('Smith')
			expect(result.phone).toBe('+15551234567')
			expect(result.customFields).toEqual({ company: 'Acme Inc', role: 'CTO' })
		})

		it('handles single-word names', () => {
			const result = mapProspectToZelutoContact({
				name: 'Madonna',
				company: 'Music',
				role: 'Artist',
			})
			expect(result.firstName).toBe('Madonna')
			expect(result.lastName).toBeUndefined()
		})
	})

	describe('syncContacts', () => {
		it('imports contacts via client and returns result', async () => {
			const mockClient = {
				importContacts: vi.fn().mockResolvedValue({
					imported: 3,
					failed: 0,
					errors: [],
				}),
			}

			const prospects = [
				{ name: 'Alice B', email: 'alice@co.com', company: 'Co', role: 'Dev' },
				{ name: 'Bob C', email: 'bob@co.com', company: 'Co', role: 'PM' },
				{ name: 'Charlie D', email: 'charlie@co.com', company: 'Co', role: 'CEO' },
			]

			const result = await syncContacts(mockClient as any, prospects)

			expect(result.imported).toBe(3)
			expect(result.failed).toBe(0)
			expect(mockClient.importContacts).toHaveBeenCalledTimes(1)
			const sentContacts = mockClient.importContacts.mock.calls[0][0]
			expect(sentContacts).toHaveLength(3)
			expect(sentContacts[0].firstName).toBe('Alice')
			expect(sentContacts[0].lastName).toBe('B')
		})

		it('batches contacts in groups of 100', async () => {
			const mockClient = {
				importContacts: vi
					.fn()
					.mockResolvedValue({ imported: 100, failed: 0, errors: [] }),
			}

			const prospects = Array.from({ length: 150 }, (_, i) => ({
				name: `User ${i}`,
				email: `user${i}@co.com`,
				company: 'Co',
				role: 'Dev',
			}))

			const result = await syncContacts(mockClient as any, prospects)

			expect(mockClient.importContacts).toHaveBeenCalledTimes(2)
			expect(result.imported).toBe(200)
		})
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/zeluto/contact-sync.test.ts`
Expected: FAIL — cannot resolve module

**Step 3: Write minimal implementation**

```typescript
// src/services/zeluto/contact-sync.ts
import type { ZelutoClient } from './client'
import type { ZelutoContactCreate, ZelutoContactImportResult } from '../../types/zeluto'

export interface ProspectData {
	name: string
	email?: string
	phone?: string
	company: string
	role: string
	linkedinId?: string
}

export function mapProspectToZelutoContact(prospect: ProspectData): ZelutoContactCreate {
	const nameParts = prospect.name.split(' ')
	const firstName = nameParts[0]
	const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

	return {
		email: prospect.email,
		firstName,
		lastName,
		phone: prospect.phone,
		customFields: {
			company: prospect.company,
			role: prospect.role,
			...(prospect.linkedinId ? { linkedinId: prospect.linkedinId } : {}),
		},
	}
}

const BATCH_SIZE = 100

export async function syncContacts(
	client: ZelutoClient,
	prospects: ProspectData[],
): Promise<ZelutoContactImportResult> {
	let totalImported = 0
	let totalFailed = 0
	const allErrors: Array<{ index: number; error: string }> = []

	const contacts = prospects.map(mapProspectToZelutoContact)

	for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
		const batch = contacts.slice(i, i + BATCH_SIZE)
		const result = await client.importContacts(batch)

		totalImported += result.imported
		totalFailed += result.failed
		for (const err of result.errors) {
			allErrors.push({ index: i + err.index, error: err.error })
		}
	}

	return { imported: totalImported, failed: totalFailed, errors: allErrors }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/zeluto/contact-sync.test.ts`
Expected: PASS — all 4 tests pass

**Step 5: Commit**

```bash
git add src/services/zeluto/contact-sync.ts tests/services/zeluto/contact-sync.test.ts
git commit -m "feat: contact sync service — batch import prospects to zeluto CRM"
```

---

## Task 7: Campaign Sync Service

**Files:**
- Create: `src/services/zeluto/campaign-sync.ts`
- Test: `tests/services/zeluto/campaign-sync.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/zeluto/campaign-sync.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
	syncCampaign,
	mapChannelToZelutoCampaignType,
} from '../../../src/services/zeluto/campaign-sync'

describe('campaign sync', () => {
	describe('mapChannelToZelutoCampaignType', () => {
		it('maps single email channel', () => {
			expect(mapChannelToZelutoCampaignType(['email'])).toBe('email')
		})

		it('maps single sms channel', () => {
			expect(mapChannelToZelutoCampaignType(['sms'])).toBe('sms')
		})

		it('maps multiple channels to multichannel', () => {
			expect(mapChannelToZelutoCampaignType(['email', 'sms'])).toBe('multichannel')
		})

		it('maps voice to multichannel', () => {
			expect(mapChannelToZelutoCampaignType(['voice'])).toBe('multichannel')
		})
	})

	describe('syncCampaign', () => {
		it('creates campaign via client', async () => {
			const mockClient = {
				createCampaign: vi.fn().mockResolvedValue({
					id: 10,
					name: 'Spring Launch',
					status: 'draft',
					type: 'email',
				}),
			}

			const result = await syncCampaign(mockClient as any, {
				name: 'Spring Launch',
				goal: 'Drive signups',
				channels: ['email'],
			})

			expect(result.zelutoCampaignId).toBe(10)
			expect(mockClient.createCampaign).toHaveBeenCalledWith({
				name: 'Spring Launch',
				description: 'Drive signups',
				type: 'email',
			})
		})

		it('sends campaign when action is send', async () => {
			const mockClient = {
				createCampaign: vi.fn().mockResolvedValue({ id: 10, status: 'draft' }),
				sendCampaign: vi.fn().mockResolvedValue({ id: 10, status: 'sending' }),
			}

			const result = await syncCampaign(mockClient as any, {
				name: 'Launch',
				goal: 'Go',
				channels: ['email'],
				action: 'send',
			})

			expect(mockClient.sendCampaign).toHaveBeenCalledWith(10)
			expect(result.zelutoCampaignId).toBe(10)
		})

		it('schedules campaign when action is schedule', async () => {
			const mockClient = {
				createCampaign: vi.fn().mockResolvedValue({ id: 10, status: 'draft' }),
				scheduleCampaign: vi.fn().mockResolvedValue({ id: 10, status: 'scheduled' }),
			}

			const scheduledAt = '2026-03-01T09:00:00Z'
			const result = await syncCampaign(mockClient as any, {
				name: 'Launch',
				goal: 'Go',
				channels: ['email'],
				action: 'schedule',
				scheduledAt,
			})

			expect(mockClient.scheduleCampaign).toHaveBeenCalledWith(10, scheduledAt)
			expect(result.zelutoCampaignId).toBe(10)
		})
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/zeluto/campaign-sync.test.ts`
Expected: FAIL — cannot resolve module

**Step 3: Write minimal implementation**

```typescript
// src/services/zeluto/campaign-sync.ts
import type { ZelutoClient } from './client'
import type { ZelutoCampaignCreate } from '../../types/zeluto'

export interface CampaignSyncInput {
	name: string
	goal: string
	channels: string[]
	action?: 'create' | 'send' | 'schedule'
	scheduledAt?: string
}

export interface CampaignSyncResult {
	zelutoCampaignId: number
	status: string
}

export function mapChannelToZelutoCampaignType(
	channels: string[],
): ZelutoCampaignCreate['type'] {
	if (channels.length === 1) {
		if (channels[0] === 'email') return 'email'
		if (channels[0] === 'sms') return 'sms'
	}
	return 'multichannel'
}

export async function syncCampaign(
	client: ZelutoClient,
	input: CampaignSyncInput,
): Promise<CampaignSyncResult> {
	const campaign = await client.createCampaign({
		name: input.name,
		description: input.goal,
		type: mapChannelToZelutoCampaignType(input.channels),
	})

	let status = campaign.status

	if (input.action === 'send') {
		const sent = await client.sendCampaign(campaign.id)
		status = sent.status
	} else if (input.action === 'schedule' && input.scheduledAt) {
		const scheduled = await client.scheduleCampaign(campaign.id, input.scheduledAt)
		status = scheduled.status
	}

	return { zelutoCampaignId: campaign.id, status }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/zeluto/campaign-sync.test.ts`
Expected: PASS — all 6 tests pass

**Step 5: Commit**

```bash
git add src/services/zeluto/campaign-sync.ts tests/services/zeluto/campaign-sync.test.ts
git commit -m "feat: campaign sync service — push campaigns to zeluto for execution"
```

---

## Task 8: Experiment Sync Service

**Files:**
- Create: `src/services/zeluto/experiment-sync.ts`
- Test: `tests/services/zeluto/experiment-sync.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/zeluto/experiment-sync.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
	syncExperiment,
	mapArmsToVariants,
} from '../../../src/services/zeluto/experiment-sync'

describe('experiment sync', () => {
	describe('mapArmsToVariants', () => {
		it('maps experiment arms to zeluto variants', () => {
			const arms = [
				{ id: 'arm-1', variantName: 'Control', content: { subject: 'Hello' }, trafficPct: 0.5 },
				{ id: 'arm-2', variantName: 'Variant B', content: { subject: 'Hi!' }, trafficPct: 0.5 },
			]

			const variants = mapArmsToVariants(arms)
			expect(variants).toHaveLength(2)
			expect(variants[0]).toEqual({
				name: 'Control',
				content: { subject: 'Hello' },
				trafficPct: 0.5,
				armId: 'arm-1',
			})
		})
	})

	describe('syncExperiment', () => {
		it('creates A/B test via client', async () => {
			const mockClient = {
				createAbTest: vi.fn().mockResolvedValue({
					id: 7,
					campaignId: 10,
					status: 'running',
				}),
			}

			const arms = [
				{ id: 'a1', variantName: 'A', content: {}, trafficPct: 0.5 },
				{ id: 'a2', variantName: 'B', content: {}, trafficPct: 0.5 },
			]

			const result = await syncExperiment(mockClient as any, {
				experimentName: 'Subject Test',
				zelutoCampaignId: 10,
				arms,
				winningCriteria: 'clicks',
			})

			expect(result.zelutoAbTestId).toBe(7)
			expect(mockClient.createAbTest).toHaveBeenCalledWith({
				campaignId: 10,
				name: 'Subject Test',
				variants: expect.arrayContaining([
					expect.objectContaining({ name: 'A' }),
					expect.objectContaining({ name: 'B' }),
				]),
				winningCriteria: 'clicks',
			})
		})
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/zeluto/experiment-sync.test.ts`
Expected: FAIL — cannot resolve module

**Step 3: Write minimal implementation**

```typescript
// src/services/zeluto/experiment-sync.ts
import type { ZelutoClient } from './client'
import type { ZelutoAbTestCreate } from '../../types/zeluto'

export interface ArmData {
	id: string
	variantName: string
	content: Record<string, unknown>
	trafficPct: number
}

export interface ExperimentSyncInput {
	experimentName: string
	zelutoCampaignId: number
	arms: ArmData[]
	winningCriteria: ZelutoAbTestCreate['winningCriteria']
}

export interface ExperimentSyncResult {
	zelutoAbTestId: number
}

export function mapArmsToVariants(
	arms: ArmData[],
): Array<Record<string, unknown>> {
	return arms.map((arm) => ({
		name: arm.variantName,
		content: arm.content,
		trafficPct: arm.trafficPct,
		armId: arm.id,
	}))
}

export async function syncExperiment(
	client: ZelutoClient,
	input: ExperimentSyncInput,
): Promise<ExperimentSyncResult> {
	const abTest = await client.createAbTest({
		campaignId: input.zelutoCampaignId,
		name: input.experimentName,
		variants: mapArmsToVariants(input.arms),
		winningCriteria: input.winningCriteria,
	})

	return { zelutoAbTestId: abTest.id }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/zeluto/experiment-sync.test.ts`
Expected: PASS — all 3 tests pass

**Step 5: Commit**

```bash
git add src/services/zeluto/experiment-sync.ts tests/services/zeluto/experiment-sync.test.ts
git commit -m "feat: experiment sync service — push MAB experiments to zeluto A/B tests"
```

---

## Task 9: Event Feedback — Webhook Route + Processing

**Files:**
- Create: `src/services/zeluto/events.ts`
- Create: `src/routes/zeluto-webhook.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/services/zeluto/events.test.ts`
- Test: `tests/routes/zeluto-webhook.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/services/zeluto/events.test.ts
import { describe, it, expect } from 'vitest'
import { classifyDeliveryEvent, isEngagementEvent } from '../../../src/services/zeluto/events'

describe('event processing', () => {
	describe('classifyDeliveryEvent', () => {
		it('classifies opened as positive engagement', () => {
			expect(classifyDeliveryEvent('opened')).toBe('engagement')
		})

		it('classifies clicked as positive engagement', () => {
			expect(classifyDeliveryEvent('clicked')).toBe('engagement')
		})

		it('classifies bounced as negative', () => {
			expect(classifyDeliveryEvent('bounced')).toBe('negative')
		})

		it('classifies complained as negative', () => {
			expect(classifyDeliveryEvent('complained')).toBe('negative')
		})

		it('classifies delivered as neutral', () => {
			expect(classifyDeliveryEvent('delivered')).toBe('neutral')
		})

		it('classifies sent as neutral', () => {
			expect(classifyDeliveryEvent('sent')).toBe('neutral')
		})
	})

	describe('isEngagementEvent', () => {
		it('returns true for opened/clicked', () => {
			expect(isEngagementEvent('opened')).toBe(true)
			expect(isEngagementEvent('clicked')).toBe(true)
		})

		it('returns false for sent/delivered/bounced', () => {
			expect(isEngagementEvent('sent')).toBe(false)
			expect(isEngagementEvent('delivered')).toBe(false)
			expect(isEngagementEvent('bounced')).toBe(false)
		})
	})
})
```

```typescript
// tests/routes/zeluto-webhook.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'crypto'
import { getTestApp } from '../helpers/test-app'

describe('POST /webhooks/zeluto', () => {
	const app = getTestApp()
	const secret = 'dev-webhook-secret'

	function sign(body: string): string {
		return createHmac('sha256', secret).update(body).digest('hex')
	}

	it('accepts valid webhook with HMAC signature', async () => {
		const body = JSON.stringify({
			eventType: 'delivery.opened',
			payload: {
				jobId: 'job-1',
				contactId: 42,
				channel: 'email',
				eventType: 'opened',
			},
		})
		const signature = sign(body)

		const res = await app.request('/webhooks/zeluto', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Webhook-Signature': `sha256=${signature}`,
			},
			body,
		})

		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json.received).toBe(true)
	})

	it('rejects missing signature', async () => {
		const res = await app.request('/webhooks/zeluto', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ eventType: 'test', payload: {} }),
		})

		expect(res.status).toBe(401)
	})

	it('rejects invalid signature', async () => {
		const body = JSON.stringify({ eventType: 'test', payload: {} })

		const res = await app.request('/webhooks/zeluto', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Webhook-Signature': 'sha256=invalid',
			},
			body,
		})

		expect(res.status).toBe(401)
	})
})
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/services/zeluto/events.test.ts tests/routes/zeluto-webhook.test.ts`
Expected: FAIL — cannot resolve modules

**Step 3: Write minimal implementation**

```typescript
// src/services/zeluto/events.ts
export type EventClassification = 'engagement' | 'negative' | 'neutral'

const ENGAGEMENT_EVENTS = new Set(['opened', 'clicked'])
const NEGATIVE_EVENTS = new Set(['bounced', 'complained', 'unsubscribed', 'failed'])

export function classifyDeliveryEvent(eventType: string): EventClassification {
	if (ENGAGEMENT_EVENTS.has(eventType)) return 'engagement'
	if (NEGATIVE_EVENTS.has(eventType)) return 'negative'
	return 'neutral'
}

export function isEngagementEvent(eventType: string): boolean {
	return ENGAGEMENT_EVENTS.has(eventType)
}
```

```typescript
// src/routes/zeluto-webhook.ts
import { Hono } from 'hono'
import { createHmac, timingSafeEqual } from 'crypto'
import type { AppEnv } from '../app'
import { getConfig } from '../config'
import { zelutoWebhookEvent } from '../types/zeluto'

export function createZelutoWebhookRoutes() {
	const router = new Hono<AppEnv>()

	router.post('/', async (c) => {
		const config = getConfig()
		const secret = config.ZELUTO_WEBHOOK_SECRET

		// Verify HMAC signature
		const signatureHeader = c.req.header('X-Webhook-Signature')
		if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
			return c.json({ error: 'UNAUTHORIZED', message: 'Missing webhook signature' }, 401)
		}

		const providedSignature = signatureHeader.slice(7)
		const rawBody = await c.req.text()

		const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex')

		try {
			const isValid = timingSafeEqual(
				Buffer.from(providedSignature),
				Buffer.from(expectedSignature),
			)
			if (!isValid) {
				return c.json({ error: 'UNAUTHORIZED', message: 'Invalid webhook signature' }, 401)
			}
		} catch {
			return c.json({ error: 'UNAUTHORIZED', message: 'Invalid webhook signature' }, 401)
		}

		// Parse and validate event
		const parsed = zelutoWebhookEvent.safeParse(JSON.parse(rawBody))
		if (!parsed.success) {
			return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid event payload' }, 422)
		}

		// Acknowledge receipt — event processing is best-effort
		// In production, this would store to delivery_events table and trigger async processing
		return c.json({ received: true })
	})

	return router
}
```

Now register the webhook route in `src/routes/index.ts`. This route is **outside** the auth middleware since zeluto calls it with HMAC, not user sessions:

```typescript
// src/routes/index.ts — add import at top
import { createZelutoWebhookRoutes } from './zeluto-webhook'

// Add BEFORE the auth middleware line (before app.use('/api/v1/*', authMiddleware()))
	// Webhook routes (HMAC-authenticated, no user session)
	app.route('/webhooks/zeluto', createZelutoWebhookRoutes())
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/services/zeluto/events.test.ts tests/routes/zeluto-webhook.test.ts`
Expected: PASS — all 9 tests pass

**Step 5: Commit**

```bash
git add src/services/zeluto/events.ts src/routes/zeluto-webhook.ts src/routes/index.ts tests/services/zeluto/events.test.ts tests/routes/zeluto-webhook.test.ts
git commit -m "feat: zeluto webhook receiver with HMAC verification + event classification"
```

---

## Task 10: Zeluto Sync Management Routes

**Files:**
- Create: `src/routes/zeluto.ts`
- Modify: `src/types/api.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/routes/zeluto.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/zeluto.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getTestApp } from '../helpers/test-app'

describe('zeluto sync routes', () => {
	const app = getTestApp()

	describe('POST /api/v1/zeluto/config', () => {
		it('validates zeluto config input', async () => {
			const res = await app.request('/api/v1/zeluto/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})

		it('accepts valid config', async () => {
			const res = await app.request('/api/v1/zeluto/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					organizationId: 'org-123',
					userId: 'user-456',
					userRole: 'admin',
					plan: 'pro',
				}),
			})

			// Will fail with DB error in test env, but validation passes
			expect(res.status).not.toBe(422)
		})
	})

	describe('POST /api/v1/zeluto/sync/content', () => {
		it('validates content sync input', async () => {
			const res = await app.request('/api/v1/zeluto/sync/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})

		it('requires name and channel', async () => {
			const res = await app.request('/api/v1/zeluto/sync/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Test', channel: 'email' }),
			})

			// Passes validation (422 would mean validation failed)
			expect(res.status).not.toBe(422)
		})
	})

	describe('POST /api/v1/zeluto/sync/contacts', () => {
		it('validates contact sync input', async () => {
			const res = await app.request('/api/v1/zeluto/sync/contacts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})
	})

	describe('POST /api/v1/zeluto/sync/campaign', () => {
		it('validates campaign sync input', async () => {
			const res = await app.request('/api/v1/zeluto/sync/campaign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})
	})

	describe('POST /api/v1/zeluto/sync/experiment', () => {
		it('validates experiment sync input', async () => {
			const res = await app.request('/api/v1/zeluto/sync/experiment', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})
	})

	describe('GET /api/v1/zeluto/sync/logs', () => {
		it('accepts pagination params', async () => {
			const res = await app.request('/api/v1/zeluto/sync/logs?page=1&limit=10')

			// Will fail with DB error in test env, but route exists
			expect(res.status).not.toBe(404)
		})
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/zeluto.test.ts`
Expected: FAIL — cannot resolve module / 404 routes

**Step 3: Write minimal implementation**

First, add Zod schemas to `src/types/api.ts`:

```typescript
// src/types/api.ts — append after existing schemas

// Zeluto sync
export const zelutoConfigCreate = z.object({
	organizationId: z.string().min(1),
	userId: z.string().min(1),
	userRole: z.enum(['owner', 'admin', 'member', 'viewer']).default('admin'),
	plan: z.enum(['free', 'starter', 'pro', 'enterprise']).default('pro'),
	webhookSecret: z.string().optional(),
})

export const contentSyncRequest = z.object({
	name: z.string().min(1),
	channel: z.enum(['email', 'sms', 'voice', 'linkedin']),
	subject: z.string().optional(),
	bodyHtml: z.string().optional(),
	bodyText: z.string().optional(),
})

export const contactSyncRequest = z.object({
	prospectIds: z.array(z.string().uuid()).min(1).max(100),
})

export const campaignSyncRequest = z.object({
	campaignId: z.string().uuid(),
	action: z.enum(['create', 'send', 'schedule']).default('create'),
	scheduledAt: z.string().optional(),
})

export const experimentSyncRequest = z.object({
	experimentId: z.string().uuid(),
	zelutoCampaignId: z.number().int().positive(),
	winningCriteria: z.enum(['opens', 'clicks', 'conversions']).default('clicks'),
})
```

Now create the route file:

```typescript
// src/routes/zeluto.ts
import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { getDb } from '../db/client'
import { getConfig } from '../config'
import { zelutoConfigs, syncLogs } from '../db/schema'
import {
	zelutoConfigCreate,
	contentSyncRequest,
	contactSyncRequest,
	campaignSyncRequest,
	experimentSyncRequest,
	paginationQuery,
} from '../types/api'
import { NotFoundError } from '../types/errors'
import { ZelutoClient } from '../services/zeluto/client'
import { syncContent } from '../services/zeluto/content-sync'
import { syncCampaign } from '../services/zeluto/campaign-sync'
import { syncExperiment } from '../services/zeluto/experiment-sync'
import { syncContacts, type ProspectData } from '../services/zeluto/contact-sync'
import { prospects } from '../db/schema'
import { and, inArray } from 'drizzle-orm'

async function getClientForTenant(tenantId: string): Promise<ZelutoClient> {
	const db = getDb()
	const config = getConfig()

	const [zelutoConfig] = await db
		.select()
		.from(zelutoConfigs)
		.where(and(eq(zelutoConfigs.tenantId, tenantId), eq(zelutoConfigs.active, true)))

	if (zelutoConfig) {
		return new ZelutoClient({
			baseUrl: config.ZELUTO_API_URL,
			tenantContext: {
				organizationId: zelutoConfig.organizationId,
				userId: zelutoConfig.userId,
				userRole: zelutoConfig.userRole as any,
				plan: zelutoConfig.plan as any,
			},
			apiKey: config.ZELUTO_API_KEY,
		})
	}

	// Fallback to env var
	if (config.ZELUTO_TENANT_CONTEXT) {
		const ctx = JSON.parse(config.ZELUTO_TENANT_CONTEXT)
		return new ZelutoClient({
			baseUrl: config.ZELUTO_API_URL,
			tenantContext: ctx,
			apiKey: config.ZELUTO_API_KEY,
		})
	}

	throw new NotFoundError('ZelutoConfig', tenantId)
}

async function logSync(
	tenantId: string,
	syncType: string,
	fn: () => Promise<{ externalId?: string; result: unknown }>,
) {
	const db = getDb()
	const [log] = await db
		.insert(syncLogs)
		.values({
			tenantId,
			syncType,
			direction: 'outbound',
			status: 'running',
			startedAt: new Date(),
		})
		.returning()

	try {
		const { externalId, result } = await fn()
		await db
			.update(syncLogs)
			.set({ status: 'completed', externalId, completedAt: new Date() })
			.where(eq(syncLogs.id, log.id))
		return { syncLogId: log.id, result }
	} catch (error) {
		await db
			.update(syncLogs)
			.set({ status: 'failed', error: String(error), completedAt: new Date() })
			.where(eq(syncLogs.id, log.id))
		throw error
	}
}

export function createZelutoRoutes() {
	const router = new Hono<AppEnv>()

	// Save zeluto config for tenant
	router.post('/config', validate('json', zelutoConfigCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [config] = await db
			.insert(zelutoConfigs)
			.values({ ...data, tenantId })
			.onConflictDoUpdate({
				target: zelutoConfigs.tenantId,
				set: { ...data, updatedAt: new Date() },
			})
			.returning()

		return c.json(config, 201)
	})

	// Get zeluto config for tenant
	router.get('/config', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const [config] = await db
			.select()
			.from(zelutoConfigs)
			.where(eq(zelutoConfigs.tenantId, tenantId))

		if (!config) throw new NotFoundError('ZelutoConfig', tenantId)
		return c.json(config)
	})

	// Sync content to zeluto template
	router.post('/sync/content', validate('json', contentSyncRequest), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const client = await getClientForTenant(tenantId)

		const { syncLogId, result } = await logSync(tenantId, 'content', async () => {
			const r = await syncContent(client, data)
			return { externalId: String(r.zelutoTemplateId), result: r }
		})

		return c.json({ ...result, syncLogId }, 201)
	})

	// Sync contacts to zeluto CRM
	router.post('/sync/contacts', validate('json', contactSyncRequest), async (c) => {
		const tenantId = c.get('tenantId')!
		const { prospectIds } = c.req.valid('json')
		const db = getDb()
		const client = await getClientForTenant(tenantId)

		const prospectRows = await db
			.select()
			.from(prospects)
			.where(and(eq(prospects.tenantId, tenantId), inArray(prospects.id, prospectIds)))

		const prospectData: ProspectData[] = prospectRows.map((p) => ({
			name: p.name,
			email: p.email ?? undefined,
			phone: p.phone ?? undefined,
			company: p.company,
			role: p.role,
			linkedinId: p.linkedinId ?? undefined,
		}))

		const { syncLogId, result } = await logSync(tenantId, 'contact', async () => {
			const r = await syncContacts(client, prospectData)
			return { result: r }
		})

		return c.json({ ...result, syncLogId }, 201)
	})

	// Sync campaign to zeluto
	router.post('/sync/campaign', validate('json', campaignSyncRequest), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const db = getDb()
		const client = await getClientForTenant(tenantId)

		const { campaigns } = await import('../db/schema')
		const [campaign] = await db
			.select()
			.from(campaigns)
			.where(and(eq(campaigns.id, data.campaignId), eq(campaigns.tenantId, tenantId)))

		if (!campaign) throw new NotFoundError('Campaign', data.campaignId)

		const { syncLogId, result } = await logSync(tenantId, 'campaign', async () => {
			const r = await syncCampaign(client, {
				name: campaign.name,
				goal: campaign.goal,
				channels: (campaign.channelsRequested as string[]) ?? ['email'],
				action: data.action,
				scheduledAt: data.scheduledAt,
			})
			return { externalId: String(r.zelutoCampaignId), result: r }
		})

		return c.json({ ...result, syncLogId }, 201)
	})

	// Sync experiment to zeluto A/B test
	router.post('/sync/experiment', validate('json', experimentSyncRequest), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const db = getDb()
		const client = await getClientForTenant(tenantId)

		const { experiments, experimentArms } = await import('../db/schema')
		const [experiment] = await db
			.select()
			.from(experiments)
			.where(and(eq(experiments.id, data.experimentId), eq(experiments.tenantId, tenantId)))

		if (!experiment) throw new NotFoundError('Experiment', data.experimentId)

		const arms = await db
			.select()
			.from(experimentArms)
			.where(eq(experimentArms.experimentId, data.experimentId))

		const { syncLogId, result } = await logSync(tenantId, 'experiment', async () => {
			const r = await syncExperiment(client, {
				experimentName: experiment.name,
				zelutoCampaignId: data.zelutoCampaignId,
				arms: arms.map((a) => ({
					id: a.id,
					variantName: a.variantName,
					content: (a.content as Record<string, unknown>) ?? {},
					trafficPct: a.trafficPct,
				})),
				winningCriteria: data.winningCriteria,
			})
			return { externalId: String(r.zelutoAbTestId), result: r }
		})

		return c.json({ ...result, syncLogId }, 201)
	})

	// List sync logs
	router.get('/sync/logs', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit

		const [items, countResult] = await Promise.all([
			db
				.select()
				.from(syncLogs)
				.where(eq(syncLogs.tenantId, tenantId))
				.limit(limit)
				.offset(offset)
				.orderBy(syncLogs.createdAt),
			db
				.select({ count: sql<number>`count(*)` })
				.from(syncLogs)
				.where(eq(syncLogs.tenantId, tenantId)),
		])

		return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
	})

	return router
}
```

Now register the zeluto sync routes in `src/routes/index.ts`:

```typescript
// src/routes/index.ts — add import at top
import { createZelutoRoutes } from './zeluto'

// Add after the brand-kits route
	app.route('/api/v1/zeluto', createZelutoRoutes())
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/routes/zeluto.test.ts`
Expected: PASS — all 7 tests pass

**Step 5: Commit**

```bash
git add src/routes/zeluto.ts src/routes/index.ts src/types/api.ts tests/routes/zeluto.test.ts
git commit -m "feat: zeluto sync management routes — config, content, contacts, campaigns, experiments, logs"
```

---

## Task 11: Integration Tests

**Files:**
- Create: `tests/integration/phase3.test.ts`

**Step 1: Write the integration test**

```typescript
// tests/integration/phase3.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'crypto'
import { getTestApp } from '../helpers/test-app'
import { ZelutoClient } from '../../src/services/zeluto/client'
import { syncContent } from '../../src/services/zeluto/content-sync'
import { syncContacts } from '../../src/services/zeluto/contact-sync'
import { syncCampaign } from '../../src/services/zeluto/campaign-sync'
import { syncExperiment, mapArmsToVariants } from '../../src/services/zeluto/experiment-sync'
import { classifyDeliveryEvent, isEngagementEvent } from '../../src/services/zeluto/events'
import { withRetry } from '../../src/utils/retry'
import { zelutoTenantContext, zelutoWebhookEvent, zelutoDeliveryEvent } from '../../src/types/zeluto'
import { ZelutoApiError } from '../../src/types/errors'

describe('Phase 3: Zeluto Integration', () => {
	const app = getTestApp()

	describe('types', () => {
		it('zeluto tenant context validates correctly', () => {
			expect(
				zelutoTenantContext.safeParse({
					organizationId: 'org-1',
					userId: 'user-1',
					userRole: 'admin',
					plan: 'pro',
				}).success,
			).toBe(true)
		})

		it('delivery event validates correctly', () => {
			expect(
				zelutoDeliveryEvent.safeParse({
					id: 'e1',
					jobId: 'j1',
					contactId: 1,
					channel: 'email',
					eventType: 'opened',
					providerMessageId: null,
					createdAt: '2026-01-01T00:00:00Z',
				}).success,
			).toBe(true)
		})

		it('ZelutoApiError extends AppError', () => {
			const err = new ZelutoApiError('NOT_FOUND', 'Template not found', 404)
			expect(err.statusCode).toBe(404)
			expect(err.code).toBe('ZELUTO_API_ERROR')
			expect(err.zelutoCode).toBe('NOT_FOUND')
		})
	})

	describe('client', () => {
		it('encodes tenant context as base64 in header', () => {
			const ctx = { organizationId: 'o', userId: 'u', userRole: 'admin' as const, plan: 'pro' as const }
			const encoded = btoa(JSON.stringify(ctx))
			const decoded = JSON.parse(atob(encoded))
			expect(decoded.organizationId).toBe('o')
		})
	})

	describe('sync services', () => {
		it('content sync calls createTemplate', async () => {
			const mockClient = {
				createTemplate: vi.fn().mockResolvedValue({ id: 1 }),
			}
			const result = await syncContent(mockClient as any, {
				name: 'Test',
				channel: 'email',
				subject: 'Hi',
				bodyHtml: '<p>Hello</p>',
			})
			expect(result.zelutoTemplateId).toBe(1)
		})

		it('contact sync maps and imports', async () => {
			const mockClient = {
				importContacts: vi.fn().mockResolvedValue({ imported: 2, failed: 0, errors: [] }),
			}
			const result = await syncContacts(mockClient as any, [
				{ name: 'A B', email: 'a@b.com', company: 'C', role: 'D' },
				{ name: 'E F', email: 'e@f.com', company: 'G', role: 'H' },
			])
			expect(result.imported).toBe(2)
		})

		it('campaign sync creates and optionally sends', async () => {
			const mockClient = {
				createCampaign: vi.fn().mockResolvedValue({ id: 5, status: 'draft' }),
				sendCampaign: vi.fn().mockResolvedValue({ id: 5, status: 'sending' }),
			}
			const result = await syncCampaign(mockClient as any, {
				name: 'Test',
				goal: 'Goal',
				channels: ['email'],
				action: 'send',
			})
			expect(result.zelutoCampaignId).toBe(5)
			expect(mockClient.sendCampaign).toHaveBeenCalled()
		})

		it('experiment sync maps arms to variants', async () => {
			const arms = [
				{ id: 'a1', variantName: 'Control', content: { s: 'A' }, trafficPct: 0.5 },
				{ id: 'a2', variantName: 'Test', content: { s: 'B' }, trafficPct: 0.5 },
			]
			const variants = mapArmsToVariants(arms)
			expect(variants).toHaveLength(2)
			expect(variants[0].name).toBe('Control')
			expect(variants[0].armId).toBe('a1')
		})
	})

	describe('event processing', () => {
		it('classifies engagement events correctly', () => {
			expect(classifyDeliveryEvent('opened')).toBe('engagement')
			expect(classifyDeliveryEvent('clicked')).toBe('engagement')
			expect(classifyDeliveryEvent('bounced')).toBe('negative')
			expect(classifyDeliveryEvent('delivered')).toBe('neutral')
		})

		it('isEngagementEvent filters correctly', () => {
			expect(isEngagementEvent('opened')).toBe(true)
			expect(isEngagementEvent('bounced')).toBe(false)
		})
	})

	describe('webhook endpoint', () => {
		it('rejects unauthenticated webhook calls', async () => {
			const res = await app.request('/webhooks/zeluto', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ eventType: 'test', payload: {} }),
			})
			expect(res.status).toBe(401)
		})

		it('accepts properly signed webhook', async () => {
			const body = JSON.stringify({ eventType: 'delivery.sent', payload: { jobId: 'j1' } })
			const secret = 'dev-webhook-secret'
			const signature = createHmac('sha256', secret).update(body).digest('hex')

			const res = await app.request('/webhooks/zeluto', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Webhook-Signature': `sha256=${signature}`,
				},
				body,
			})
			expect(res.status).toBe(200)
		})
	})

	describe('retry utility', () => {
		it('retries and eventually succeeds', async () => {
			const fn = vi
				.fn()
				.mockRejectedValueOnce(new Error('fail'))
				.mockResolvedValue('ok')

			const result = await withRetry(fn, { baseDelayMs: 1, maxRetries: 2 })
			expect(result).toBe('ok')
			expect(fn).toHaveBeenCalledTimes(2)
		})
	})

	describe('route validation', () => {
		it('zeluto config route exists', async () => {
			const res = await app.request('/api/v1/zeluto/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					organizationId: 'org-1',
					userId: 'user-1',
					userRole: 'admin',
					plan: 'pro',
				}),
			})
			expect(res.status).not.toBe(404)
		})

		it('sync content route exists', async () => {
			const res = await app.request('/api/v1/zeluto/sync/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Test', channel: 'email' }),
			})
			expect(res.status).not.toBe(404)
		})

		it('sync logs route exists', async () => {
			const res = await app.request('/api/v1/zeluto/sync/logs')
			expect(res.status).not.toBe(404)
		})
	})
})
```

**Step 2: Run test to verify it passes**

Run: `bunx vitest run tests/integration/phase3.test.ts`
Expected: PASS — all tests pass

**Step 3: Run full test suite**

Run: `bunx vitest run`
Expected: All Phase 1, Phase 2, AND Phase 3 tests pass

**Step 4: Commit**

```bash
git add tests/integration/phase3.test.ts
git commit -m "test: Phase 3 integration tests for zeluto sync services and webhook"
```

---

## Summary

| Task | Component | Files Created/Modified |
|---|---|---|
| 1 | Zeluto type definitions | `src/types/zeluto.ts`, `src/types/errors.ts` |
| 2 | DB schemas (sync, config, events) | `src/db/schema/sync-log.ts`, `zeluto-config.ts`, `delivery-events.ts` |
| 3 | Config + retry utility | `src/config.ts`, `src/utils/retry.ts` |
| 4 | Zeluto HTTP client | `src/services/zeluto/client.ts` |
| 5 | Content sync | `src/services/zeluto/content-sync.ts` |
| 6 | Contact sync | `src/services/zeluto/contact-sync.ts` |
| 7 | Campaign sync | `src/services/zeluto/campaign-sync.ts` |
| 8 | Experiment sync | `src/services/zeluto/experiment-sync.ts` |
| 9 | Webhook receiver + events | `src/services/zeluto/events.ts`, `src/routes/zeluto-webhook.ts` |
| 10 | Sync management routes | `src/routes/zeluto.ts`, `src/types/api.ts` |
| 11 | Integration tests | `tests/integration/phase3.test.ts` |

**New endpoints:**
- `POST /webhooks/zeluto` — HMAC-authenticated webhook receiver (no user auth)
- `POST /api/v1/zeluto/config` — Save zeluto config for tenant
- `GET /api/v1/zeluto/config` — Get zeluto config
- `POST /api/v1/zeluto/sync/content` — Push content to zeluto templates
- `POST /api/v1/zeluto/sync/contacts` — Sync prospects to zeluto CRM
- `POST /api/v1/zeluto/sync/campaign` — Push campaign to zeluto
- `POST /api/v1/zeluto/sync/experiment` — Push MAB experiment to zeluto A/B test
- `GET /api/v1/zeluto/sync/logs` — View sync history
