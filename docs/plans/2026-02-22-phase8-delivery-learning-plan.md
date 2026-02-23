# Phase 8: Platform Delivery + Learning Loop — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Publish generated content to 7 platforms (Instagram, Facebook, WhatsApp, TikTok, LinkedIn, WordPress, generic blog) via their APIs, collect real-time engagement metrics, and feed results into EvoAgentX to optimize content generation per channel.

**Architecture:** PlatformAdapter interface with per-platform implementations. Tenant OAuth for social platforms, Application Passwords for WordPress, configurable webhook for generic blogs. Engagement events flow through webhooks (Meta) or polling (TikTok, LinkedIn, WordPress) into an engagement scorer that triggers EvoAgentX micro-optimization cycles when thresholds are met.

**Tech Stack:** Meta Graph API v21 (Instagram/Facebook/WhatsApp), TikTok Content Publishing API v2, LinkedIn Posts API, WordPress REST API v2, Drizzle ORM (new tables), vitest (testing)

---

### Task 1: Platform Adapter Types

**Files:**
- Create: `src/adapters/platforms/types.ts`
- Test: `tests/adapters/platforms/types.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/platforms/types.test.ts
import { describe, it, expect } from 'vitest'
import type { PlatformAdapter, PublishResult, EngagementMetrics, PlatformConnection } from '../../../src/adapters/platforms/types'

describe('PlatformAdapter types', () => {
	it('should type-check a valid adapter implementation', () => {
		const adapter: PlatformAdapter = {
			name: 'test',
			platform: 'instagram',
			async publish(content, connection) {
				return { platformContentId: '123', url: 'https://example.com', status: 'published' }
			},
			async getEngagement(platformContentId, connection) {
				return { views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0 }
			},
		}
		expect(adapter.name).toBe('test')
		expect(adapter.platform).toBe('instagram')
	})

	it('should type-check PlatformConnection', () => {
		const conn: PlatformConnection = {
			id: 'uuid',
			tenantId: 'uuid',
			platform: 'instagram',
			accessToken: 'token',
			refreshToken: 'refresh',
			expiresAt: new Date(),
			scopes: 'instagram_basic,instagram_content_publish',
			metadata: {},
		}
		expect(conn.platform).toBe('instagram')
	})

	it('should type-check PublishResult', () => {
		const result: PublishResult = {
			platformContentId: '12345',
			url: 'https://instagram.com/p/abc',
			status: 'published',
		}
		expect(result.status).toBe('published')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/platforms/types.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/platforms/types.ts
export type Platform = 'instagram' | 'facebook' | 'whatsapp' | 'tiktok' | 'linkedin' | 'wordpress' | 'blog'

export interface PlatformConnection {
	id: string
	tenantId: string
	platform: Platform
	accessToken: string
	refreshToken?: string
	expiresAt?: Date
	scopes?: string
	metadata: Record<string, unknown>
}

export interface PublishResult {
	platformContentId: string
	url: string
	status: 'published' | 'draft' | 'scheduled' | 'processing'
}

export interface EngagementMetrics {
	views: number
	likes: number
	shares: number
	comments: number
	clicks: number
	saves: number
	conversions: number
}

export interface PlatformAdapter {
	name: string
	platform: Platform
	publish(content: unknown, connection: PlatformConnection): Promise<PublishResult>
	getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics>
	verifyWebhook?(payload: unknown, signature: string): boolean
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/platforms/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/platforms/types.ts tests/adapters/platforms/types.test.ts
git commit -m "feat(phase8): add PlatformAdapter interface and types"
```

---

### Task 2: DB Schema — platform_connections, published_content, engagement_events

**Files:**
- Create: `src/db/schema/platform-connections.ts`
- Create: `src/db/schema/published-content.ts`
- Create: `src/db/schema/engagement-events.ts`
- Modify: `src/db/schema/index.ts` — add exports
- Test: `tests/db/platform-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/platform-schema.test.ts
import { describe, it, expect } from 'vitest'
import { platformConnections } from '../../src/db/schema/platform-connections'
import { publishedContent } from '../../src/db/schema/published-content'
import { engagementEvents } from '../../src/db/schema/engagement-events'

describe('Platform schema', () => {
	it('platformConnections should have required columns', () => {
		expect(platformConnections.id).toBeDefined()
		expect(platformConnections.tenantId).toBeDefined()
		expect(platformConnections.platform).toBeDefined()
		expect(platformConnections.accessToken).toBeDefined()
	})

	it('publishedContent should have required columns', () => {
		expect(publishedContent.id).toBeDefined()
		expect(publishedContent.tenantId).toBeDefined()
		expect(publishedContent.platform).toBeDefined()
		expect(publishedContent.platformContentId).toBeDefined()
		expect(publishedContent.status).toBeDefined()
	})

	it('engagementEvents should have required columns', () => {
		expect(engagementEvents.id).toBeDefined()
		expect(engagementEvents.publishedContentId).toBeDefined()
		expect(engagementEvents.eventType).toBeDefined()
		expect(engagementEvents.count).toBeDefined()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/db/platform-schema.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/db/schema/platform-connections.ts
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const platformConnections = pgTable('platform_connections', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull(),
	platform: text('platform', {
		enum: ['instagram', 'facebook', 'whatsapp', 'tiktok', 'linkedin', 'wordpress', 'blog'],
	}).notNull(),
	accessToken: text('access_token').notNull(),
	refreshToken: text('refresh_token'),
	expiresAt: timestamp('expires_at'),
	scopes: text('scopes'),
	metadata: jsonb('metadata').default({}).notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
})
```

```typescript
// src/db/schema/published-content.ts
import { pgTable, uuid, text, timestamp, jsonb } from 'drizzle-orm/pg-core'

export const publishedContent = pgTable('published_content', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull(),
	platform: text('platform').notNull(),
	channel: text('channel').notNull(),
	platformContentId: text('platform_content_id'),
	platformUrl: text('platform_url'),
	content: jsonb('content').notNull(),
	status: text('status', {
		enum: ['draft', 'published', 'scheduled', 'processing', 'failed', 'deleted'],
	}).default('draft').notNull(),
	publishedAt: timestamp('published_at'),
	campaignId: uuid('campaign_id'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

```typescript
// src/db/schema/engagement-events.ts
import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core'

export const engagementEvents = pgTable('engagement_events', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull(),
	publishedContentId: uuid('published_content_id').notNull(),
	platform: text('platform').notNull(),
	eventType: text('event_type', {
		enum: ['view', 'like', 'share', 'comment', 'click', 'save', 'reply', 'conversion'],
	}).notNull(),
	count: integer('count').default(1).notNull(),
	metadata: jsonb('metadata').default({}).notNull(),
	recordedAt: timestamp('recorded_at').defaultNow().notNull(),
})
```

Add to `src/db/schema/index.ts`:
```typescript
export * from './platform-connections'
export * from './published-content'
export * from './engagement-events'
```

Generate migration: `bunx drizzle-kit generate`

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/db/platform-schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/db/schema/platform-connections.ts src/db/schema/published-content.ts src/db/schema/engagement-events.ts src/db/schema/index.ts src/db/migrations/ tests/db/platform-schema.test.ts
git commit -m "feat(phase8): add platform_connections, published_content, engagement_events schema"
```

---

### Task 3: OAuth Helper + Zod Schemas

**Files:**
- Create: `src/adapters/platforms/oauth.ts`
- Modify: `src/types/api.ts` — add platform/publish/engagement Zod schemas
- Modify: `src/config.ts` — add platform OAuth client IDs/secrets
- Test: `tests/adapters/platforms/oauth.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/platforms/oauth.test.ts
import { describe, it, expect } from 'vitest'
import { buildOAuthUrl, exchangeCodeForTokens } from '../../../src/adapters/platforms/oauth'

describe('OAuth helpers', () => {
	it('should build Meta OAuth URL with correct params', () => {
		const url = buildOAuthUrl('meta', {
			clientId: 'app123',
			redirectUri: 'https://pi.indices.app/api/v1/platforms/instagram/callback',
			scopes: ['instagram_basic', 'instagram_content_publish'],
			state: 'csrf-token',
		})
		expect(url).toContain('facebook.com')
		expect(url).toContain('client_id=app123')
		expect(url).toContain('instagram_basic')
		expect(url).toContain('state=csrf-token')
	})

	it('should build LinkedIn OAuth URL', () => {
		const url = buildOAuthUrl('linkedin', {
			clientId: 'linkedin-app',
			redirectUri: 'https://pi.indices.app/api/v1/platforms/linkedin/callback',
			scopes: ['w_member_social'],
			state: 'csrf-token',
		})
		expect(url).toContain('linkedin.com')
		expect(url).toContain('w_member_social')
	})

	it('should build TikTok OAuth URL', () => {
		const url = buildOAuthUrl('tiktok', {
			clientId: 'tiktok-key',
			redirectUri: 'https://pi.indices.app/api/v1/platforms/tiktok/callback',
			scopes: ['video.publish'],
			state: 'csrf-token',
		})
		expect(url).toContain('tiktok.com')
		expect(url).toContain('video.publish')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/platforms/oauth.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/platforms/oauth.ts
export interface OAuthParams {
	clientId: string
	redirectUri: string
	scopes: string[]
	state: string
}

const OAUTH_URLS: Record<string, string> = {
	meta: 'https://www.facebook.com/v21.0/dialog/oauth',
	linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
	tiktok: 'https://www.tiktok.com/v2/auth/authorize/',
}

const TOKEN_URLS: Record<string, string> = {
	meta: 'https://graph.facebook.com/v21.0/oauth/access_token',
	linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
	tiktok: 'https://open.tiktokapis.com/v2/oauth/token/',
}

export function buildOAuthUrl(provider: string, params: OAuthParams): string {
	const baseUrl = OAUTH_URLS[provider]
	if (!baseUrl) throw new Error(`Unknown OAuth provider: ${provider}`)

	const searchParams = new URLSearchParams({
		client_id: params.clientId,
		redirect_uri: params.redirectUri,
		scope: params.scopes.join(','),
		response_type: 'code',
		state: params.state,
	})

	// TikTok uses client_key instead of client_id
	if (provider === 'tiktok') {
		searchParams.delete('client_id')
		searchParams.set('client_key', params.clientId)
	}

	return `${baseUrl}?${searchParams.toString()}`
}

export async function exchangeCodeForTokens(
	provider: string,
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
	const tokenUrl = TOKEN_URLS[provider]
	if (!tokenUrl) throw new Error(`Unknown token provider: ${provider}`)

	const body = new URLSearchParams({
		client_id: provider === 'tiktok' ? '' : clientId,
		client_secret: clientSecret,
		code,
		grant_type: 'authorization_code',
		redirect_uri: redirectUri,
	})

	if (provider === 'tiktok') {
		body.set('client_key', clientId)
	}

	const res = await fetch(tokenUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body,
	})

	const data = await res.json() as Record<string, unknown>
	return {
		accessToken: (data.access_token as string) ?? '',
		refreshToken: data.refresh_token as string | undefined,
		expiresIn: data.expires_in as number | undefined,
	}
}
```

Add to `src/types/api.ts`:

```typescript
// Platform connections (Phase 8)
export const platformConnect = z.object({
	platform: z.enum(['instagram', 'facebook', 'whatsapp', 'tiktok', 'linkedin', 'wordpress', 'blog']),
})

export const wordpressConnect = z.object({
	siteUrl: z.string().url(),
	username: z.string().min(1),
	appPassword: z.string().min(1),
})

export const blogConnect = z.object({
	webhookUrl: z.string().url(),
	apiKey: z.string().optional(),
	headers: z.record(z.string(), z.string()).optional(),
})

export const publishRequest = z.object({
	platform: z.enum(['instagram', 'facebook', 'whatsapp', 'tiktok', 'linkedin', 'wordpress', 'blog']),
	channel: z.enum(['email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook', 'instagram', 'tiktok', 'youtube', 'vimeo', 'video']),
	content: z.record(z.string(), z.any()),
	campaignId: z.string().uuid().optional(),
	status: z.enum(['publish', 'draft', 'schedule']).default('publish'),
	scheduledAt: z.string().datetime().optional(),
})

export const publishBatchRequest = z.object({
	platforms: z.array(z.enum(['instagram', 'facebook', 'whatsapp', 'tiktok', 'linkedin', 'wordpress', 'blog'])).min(1),
	channel: z.string(),
	content: z.record(z.string(), z.any()),
	campaignId: z.string().uuid().optional(),
})
```

Add to `src/config.ts`:

```typescript
META_APP_ID: z.string().optional(),
META_APP_SECRET: z.string().optional(),
TIKTOK_CLIENT_KEY: z.string().optional(),
TIKTOK_CLIENT_SECRET: z.string().optional(),
LINKEDIN_CLIENT_ID: z.string().optional(),
LINKEDIN_CLIENT_SECRET: z.string().optional(),
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/platforms/oauth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/platforms/oauth.ts src/types/api.ts src/config.ts tests/adapters/platforms/oauth.test.ts
git commit -m "feat(phase8): add OAuth helpers, platform Zod schemas, and config keys"
```

---

### Task 4: Instagram Adapter (Meta Graph API)

**Files:**
- Create: `src/adapters/platforms/instagram.ts`
- Test: `tests/adapters/platforms/instagram.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/adapters/platforms/instagram.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createInstagramAdapter } from '../../../src/adapters/platforms/instagram'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1',
	tenantId: 'tenant-1',
	platform: 'instagram',
	accessToken: 'ig-token',
	metadata: { igUserId: '17841405793001' },
}

describe('InstagramAdapter', () => {
	const adapter = createInstagramAdapter()

	it('should have correct name and platform', () => {
		expect(adapter.name).toBe('instagram')
		expect(adapter.platform).toBe('instagram')
	})

	it('should publish a photo via container flow', async () => {
		// Step 1: create container
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 'container-123' }),
		})
		// Step 2: publish container
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 'media-456' }),
		})

		const result = await adapter.publish(
			{ text: 'Hello Instagram', mediaPrompt: 'product photo', hashtags: ['#test'] },
			mockConnection,
		)

		expect(result.platformContentId).toBe('media-456')
		expect(result.status).toBe('published')
		expect(mockFetch).toHaveBeenCalledTimes(2)
	})

	it('should get engagement metrics', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				data: [
					{ name: 'impressions', values: [{ value: 1000 }] },
					{ name: 'likes', values: [{ value: 50 }] },
					{ name: 'comments', values: [{ value: 10 }] },
					{ name: 'shares', values: [{ value: 5 }] },
					{ name: 'saved', values: [{ value: 20 }] },
				],
			}),
		})

		const metrics = await adapter.getEngagement('media-456', mockConnection)
		expect(metrics.views).toBe(1000)
		expect(metrics.likes).toBe(50)
		expect(metrics.saves).toBe(20)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/adapters/platforms/instagram.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// src/adapters/platforms/instagram.ts
import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export function createInstagramAdapter(): PlatformAdapter {
	return {
		name: 'instagram',
		platform: 'instagram',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const igUserId = connection.metadata.igUserId as string
			const token = connection.accessToken
			const caption = [content.text, ...(content.hashtags || []).map((h: string) => h)].join(' ')

			// Step 1: Create media container
			const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					image_url: content.mediaUrl || 'https://placeholder.com/600x600',
					caption,
					access_token: token,
				}),
			})
			const { id: creationId } = await containerRes.json() as { id: string }

			// Step 2: Publish container
			const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ creation_id: creationId, access_token: token }),
			})
			const { id: mediaId } = await publishRes.json() as { id: string }

			return {
				platformContentId: mediaId,
				url: `https://www.instagram.com/p/${mediaId}`,
				status: 'published',
			}
		},

		async getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics> {
			const res = await fetch(
				`${GRAPH_API}/${platformContentId}/insights?metric=impressions,likes,comments,shares,saved&access_token=${connection.accessToken}`,
			)
			const { data } = await res.json() as { data: Array<{ name: string; values: Array<{ value: number }> }> }

			const metrics: EngagementMetrics = { views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0 }
			for (const metric of data) {
				const value = metric.values[0]?.value ?? 0
				if (metric.name === 'impressions') metrics.views = value
				else if (metric.name === 'likes') metrics.likes = value
				else if (metric.name === 'comments') metrics.comments = value
				else if (metric.name === 'shares') metrics.shares = value
				else if (metric.name === 'saved') metrics.saves = value
			}
			return metrics
		},

		verifyWebhook(payload: unknown, signature: string): boolean {
			// Meta uses SHA-256 HMAC verification
			// Implementation depends on META_APP_SECRET
			return true // TODO: implement with crypto
		},
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/adapters/platforms/instagram.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/platforms/instagram.ts tests/adapters/platforms/instagram.test.ts
git commit -m "feat(phase8): add Instagram publishing adapter via Meta Graph API"
```

---

### Task 5: Facebook + WhatsApp Adapters

**Files:**
- Create: `src/adapters/platforms/facebook.ts`
- Create: `src/adapters/platforms/whatsapp.ts`
- Test: `tests/adapters/platforms/facebook.test.ts`
- Test: `tests/adapters/platforms/whatsapp.test.ts`

**Step 1: Write the failing tests**

```typescript
// tests/adapters/platforms/facebook.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createFacebookAdapter } from '../../../src/adapters/platforms/facebook'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1', tenantId: 'tenant-1', platform: 'facebook',
	accessToken: 'fb-token', metadata: { pageId: '1234567890' },
}

describe('FacebookAdapter', () => {
	const adapter = createFacebookAdapter()

	it('should publish a page post', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: '1234567890_9876543210' }),
		})

		const result = await adapter.publish(
			{ text: 'Hello Facebook', hashtags: ['#test'] },
			mockConnection,
		)
		expect(result.platformContentId).toBe('1234567890_9876543210')
		expect(result.status).toBe('published')
	})
})
```

```typescript
// tests/adapters/platforms/whatsapp.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createWhatsAppAdapter } from '../../../src/adapters/platforms/whatsapp'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1', tenantId: 'tenant-1', platform: 'whatsapp',
	accessToken: 'wa-token', metadata: { phoneNumberId: '111222333' },
}

describe('WhatsAppAdapter', () => {
	const adapter = createWhatsAppAdapter()

	it('should send a template message', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				messaging_product: 'whatsapp',
				messages: [{ id: 'wamid.abc123' }],
			}),
		})

		const result = await adapter.publish(
			{ message: 'Hello', templateName: 'greeting', recipientPhone: '14155551234' },
			mockConnection,
		)
		expect(result.platformContentId).toBe('wamid.abc123')
		expect(result.status).toBe('published')
	})
})
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/adapters/platforms/facebook.test.ts tests/adapters/platforms/whatsapp.test.ts`
Expected: FAIL

**Step 3: Write implementations**

```typescript
// src/adapters/platforms/facebook.ts
import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export function createFacebookAdapter(): PlatformAdapter {
	return {
		name: 'facebook',
		platform: 'facebook',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const pageId = connection.metadata.pageId as string
			const message = [content.text, ...(content.hashtags || [])].join(' ')

			const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message,
					link: content.link,
					access_token: connection.accessToken,
				}),
			})
			const { id } = await res.json() as { id: string }

			return { platformContentId: id, url: `https://facebook.com/${id}`, status: 'published' }
		},

		async getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics> {
			const res = await fetch(
				`${GRAPH_API}/${platformContentId}?fields=reactions.summary(true),comments.summary(true),shares&access_token=${connection.accessToken}`,
			)
			const data = await res.json() as any
			return {
				views: 0, // FB doesn't expose views for organic posts
				likes: data.reactions?.summary?.total_count ?? 0,
				shares: data.shares?.count ?? 0,
				comments: data.comments?.summary?.total_count ?? 0,
				clicks: 0,
				saves: 0,
				conversions: 0,
			}
		},
	}
}
```

```typescript
// src/adapters/platforms/whatsapp.ts
import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export function createWhatsAppAdapter(): PlatformAdapter {
	return {
		name: 'whatsapp',
		platform: 'whatsapp',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const phoneNumberId = connection.metadata.phoneNumberId as string

			const body: Record<string, unknown> = {
				messaging_product: 'whatsapp',
				recipient_type: 'individual',
				to: content.recipientPhone,
			}

			if (content.templateName) {
				body.type = 'template'
				body.template = {
					name: content.templateName,
					language: { code: content.languageCode || 'en_US' },
					components: content.components || [],
				}
			} else {
				body.type = 'text'
				body.text = { body: content.message }
			}

			const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${connection.accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			})
			const data = await res.json() as { messages: Array<{ id: string }> }

			return {
				platformContentId: data.messages[0]?.id ?? '',
				url: '',
				status: 'published',
			}
		},

		async getEngagement(_platformContentId: string, _connection: PlatformConnection): Promise<EngagementMetrics> {
			// WhatsApp engagement is tracked via delivery status webhooks, not polling
			return { views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0 }
		},
	}
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/adapters/platforms/facebook.test.ts tests/adapters/platforms/whatsapp.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/adapters/platforms/facebook.ts src/adapters/platforms/whatsapp.ts tests/adapters/platforms/facebook.test.ts tests/adapters/platforms/whatsapp.test.ts
git commit -m "feat(phase8): add Facebook and WhatsApp publishing adapters"
```

---

### Task 6: TikTok + LinkedIn Adapters

**Files:**
- Create: `src/adapters/platforms/tiktok.ts`
- Create: `src/adapters/platforms/linkedin.ts`
- Test: `tests/adapters/platforms/tiktok.test.ts`
- Test: `tests/adapters/platforms/linkedin.test.ts`

Follow same TDD pattern as Task 5. Key differences:

- **TikTok**: Uses `https://open.tiktokapis.com/v2/post/publish/video/init/` with `PULL_FROM_URL` source. Polling for status. `getEngagement` polls `/v2/video/query/?fields=like_count,comment_count,share_count,view_count`.
- **LinkedIn**: Uses `https://api.linkedin.com/rest/posts` with `LinkedIn-Version: 202401` header. `getEngagement` polls `/v2/socialActions/{urn}/likes` and `/comments`.

**Commit:**
```bash
git commit -m "feat(phase8): add TikTok and LinkedIn publishing adapters"
```

---

### Task 7: WordPress + Blog Adapters

**Files:**
- Create: `src/adapters/platforms/wordpress.ts`
- Create: `src/adapters/platforms/blog.ts`
- Test: `tests/adapters/platforms/wordpress.test.ts`
- Test: `tests/adapters/platforms/blog.test.ts`

Key differences:

- **WordPress**: Uses Basic Auth (username:appPassword). `POST /wp-json/wp/v2/posts` with `{ title, content, status, categories, tags }`. `getEngagement` polls `/wp-json/wp/v2/comments?post={id}`.
- **Blog**: Generic webhook POST to configurable URL with API key header. No engagement pull.

**Commit:**
```bash
git commit -m "feat(phase8): add WordPress and generic blog publishing adapters"
```

---

### Task 8: Platform Adapter Index + Factory

**Files:**
- Create: `src/adapters/platforms/index.ts`
- Test: `tests/adapters/platforms/factory.test.ts`

```typescript
// src/adapters/platforms/index.ts
import type { PlatformAdapter, Platform } from './types'
import { createInstagramAdapter } from './instagram'
import { createFacebookAdapter } from './facebook'
import { createWhatsAppAdapter } from './whatsapp'
import { createTikTokAdapter } from './tiktok'
import { createLinkedInAdapter } from './linkedin'
import { createWordPressAdapter } from './wordpress'
import { createBlogAdapter } from './blog'

export function getPlatformAdapter(platform: Platform): PlatformAdapter {
	const adapters: Record<Platform, () => PlatformAdapter> = {
		instagram: createInstagramAdapter,
		facebook: createFacebookAdapter,
		whatsapp: createWhatsAppAdapter,
		tiktok: createTikTokAdapter,
		linkedin: createLinkedInAdapter,
		wordpress: createWordPressAdapter,
		blog: createBlogAdapter,
	}

	const factory = adapters[platform]
	if (!factory) throw new Error(`Unsupported platform: ${platform}`)
	return factory()
}

export * from './types'
export * from './oauth'
```

**Commit:**
```bash
git commit -m "feat(phase8): add platform adapter factory"
```

---

### Task 9: Publisher Service

**Files:**
- Create: `src/services/publishing/publisher.ts`
- Test: `tests/services/publishing/publisher.test.ts`

Orchestrates: resolve adapter → publish → store in published_content → broadcast SSE.

```typescript
// src/services/publishing/publisher.ts
import { getPlatformAdapter } from '../../adapters/platforms'
import type { PlatformConnection, PublishResult } from '../../adapters/platforms/types'

export interface PublishInput {
	platform: string
	channel: string
	content: unknown
	connection: PlatformConnection
	campaignId?: string
	tenantId: string
}

export async function publishContent(input: PublishInput): Promise<PublishResult> {
	const adapter = getPlatformAdapter(input.platform as any)
	const result = await adapter.publish(input.content, input.connection)

	// In production: store in published_content table + broadcast SSE
	return result
}
```

**Commit:**
```bash
git commit -m "feat(phase8): add publisher orchestration service"
```

---

### Task 10: Engagement Collector + Scorer

**Files:**
- Create: `src/services/engagement/collector.ts`
- Create: `src/services/engagement/scorer.ts`
- Test: `tests/services/engagement/collector.test.ts`
- Test: `tests/services/engagement/scorer.test.ts`

```typescript
// src/services/engagement/scorer.ts
import type { EngagementMetrics } from '../../adapters/platforms/types'

const WEIGHTS = {
	views: 1,
	likes: 2,
	shares: 5,
	comments: 3,
	clicks: 3,
	saves: 4,
	conversions: 10,
}

export function scoreEngagement(metrics: EngagementMetrics): number {
	let score = 0
	for (const [key, weight] of Object.entries(WEIGHTS)) {
		score += (metrics[key as keyof EngagementMetrics] ?? 0) * weight
	}
	return score
}

export function metricsToEvoStats(metrics: EngagementMetrics) {
	const total = metrics.views || 1
	return {
		sent: total,
		delivered: total,
		opened: metrics.views,
		clicked: metrics.clicks + metrics.likes,
		bounced: 0,
		complained: 0,
	}
}
```

**Commit:**
```bash
git commit -m "feat(phase8): add engagement collector and weighted scorer"
```

---

### Task 11: Optimizer Trigger (EvoAgentX Integration)

**Files:**
- Create: `src/services/engagement/optimizer-trigger.ts`
- Test: `tests/services/engagement/optimizer-trigger.test.ts`

Checks if engagement threshold is met, then triggers EvoAgentX micro-cycle for channel-specific prompt optimization.

```typescript
// src/services/engagement/optimizer-trigger.ts
import { metricsToEvoStats } from './scorer'
import type { EngagementMetrics } from '../../adapters/platforms/types'

const DEFAULT_THRESHOLD = 100

export interface TriggerResult {
	triggered: boolean
	totalEvents: number
	threshold: number
}

export function shouldTriggerOptimization(
	totalEvents: number,
	threshold = DEFAULT_THRESHOLD,
): TriggerResult {
	return {
		triggered: totalEvents >= threshold,
		totalEvents,
		threshold,
	}
}
```

**Commit:**
```bash
git commit -m "feat(phase8): add optimization trigger with engagement threshold"
```

---

### Task 12: Platform Routes (OAuth + CRUD)

**Files:**
- Create: `src/routes/platforms.ts`
- Modify: `src/routes/index.ts` — register platform routes
- Test: `tests/routes/platforms.test.ts`

Endpoints:
- `GET /platforms` — list connected platforms
- `POST /platforms/:platform/connect` — initiate OAuth (redirect to provider)
- `GET /platforms/:platform/callback` — OAuth callback (exchange code, store tokens)
- `DELETE /platforms/:platform` — disconnect

**Commit:**
```bash
git commit -m "feat(phase8): add platform connection routes with OAuth flow"
```

---

### Task 13: Publish Routes

**Files:**
- Create: `src/routes/publish.ts`
- Modify: `src/routes/index.ts` — register publish routes
- Test: `tests/routes/publish.test.ts`

Endpoints:
- `POST /publish` — publish content to one platform
- `POST /publish/batch` — publish to multiple platforms
- `GET /publish/history` — list published content

**Commit:**
```bash
git commit -m "feat(phase8): add publishing routes for single and batch publish"
```

---

### Task 14: Engagement Webhook Routes

**Files:**
- Create: `src/routes/webhooks/meta.ts` — handles Instagram + Facebook + WhatsApp webhooks
- Modify: `src/routes/index.ts` — register webhook routes
- Test: `tests/routes/webhooks/meta.test.ts`

Meta webhook verification (GET) + event processing (POST). Normalizes events and stores in engagement_events.

Endpoints:
- `GET /webhooks/meta` — Meta verification challenge
- `POST /webhooks/meta` — Instagram/Facebook/WhatsApp engagement events

**Commit:**
```bash
git commit -m "feat(phase8): add Meta engagement webhook handler"
```

---

### Task 15: Engagement Analytics Routes

**Files:**
- Create: `src/routes/engagement.ts`
- Modify: `src/routes/index.ts` — register engagement routes
- Test: `tests/routes/engagement.test.ts`

Endpoints:
- `GET /engagement/:publishedContentId` — metrics for specific content
- `GET /engagement/summary` — aggregate by channel/time
- `GET /engagement/leaderboard` — top performing content

**Commit:**
```bash
git commit -m "feat(phase8): add engagement analytics routes"
```

---

### Task 16: Polling Service (TikTok + LinkedIn + WordPress)

**Files:**
- Create: `src/services/engagement/poller.ts`
- Test: `tests/services/engagement/poller.test.ts`

Since TikTok, LinkedIn, and WordPress don't support engagement webhooks, this service periodically polls their APIs for metrics on published content.

```typescript
// src/services/engagement/poller.ts
import { getPlatformAdapter } from '../../adapters/platforms'
import type { PlatformConnection } from '../../adapters/platforms/types'

export interface PollTarget {
	publishedContentId: string
	platformContentId: string
	platform: string
	connection: PlatformConnection
}

export async function pollEngagement(targets: PollTarget[]) {
	const results = await Promise.all(
		targets.map(async (target) => {
			const adapter = getPlatformAdapter(target.platform as any)
			const metrics = await adapter.getEngagement(target.platformContentId, target.connection)
			return { ...target, metrics }
		}),
	)
	return results
}
```

**Commit:**
```bash
git commit -m "feat(phase8): add engagement polling service for TikTok, LinkedIn, WordPress"
```

---

### Task 17: Integration Test

**Files:**
- Create: `tests/integration/phase8.test.ts`

Tests the full cycle: publish → collect engagement → check threshold → verify optimization trigger.

```typescript
// tests/integration/phase8.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getPlatformAdapter } from '../../src/adapters/platforms'
import { scoreEngagement, metricsToEvoStats } from '../../src/services/engagement/scorer'
import { shouldTriggerOptimization } from '../../src/services/engagement/optimizer-trigger'
import type { EngagementMetrics } from '../../src/adapters/platforms/types'

describe('Phase 8 integration: publish → engage → learn', () => {
	it('should score engagement with correct weights', () => {
		const metrics: EngagementMetrics = {
			views: 1000, likes: 50, shares: 10, comments: 20,
			clicks: 30, saves: 15, conversions: 5,
		}

		const score = scoreEngagement(metrics)
		// 1000*1 + 50*2 + 10*5 + 20*3 + 30*3 + 15*4 + 5*10
		expect(score).toBe(1000 + 100 + 50 + 60 + 90 + 60 + 50)
	})

	it('should convert metrics to EvoAgentX CampaignStats', () => {
		const metrics: EngagementMetrics = {
			views: 500, likes: 25, shares: 5, comments: 10,
			clicks: 15, saves: 8, conversions: 3,
		}

		const stats = metricsToEvoStats(metrics)
		expect(stats.sent).toBe(500)
		expect(stats.opened).toBe(500)
		expect(stats.clicked).toBe(40) // clicks + likes
	})

	it('should trigger optimization when threshold met', () => {
		const result = shouldTriggerOptimization(150, 100)
		expect(result.triggered).toBe(true)
	})

	it('should not trigger optimization below threshold', () => {
		const result = shouldTriggerOptimization(50, 100)
		expect(result.triggered).toBe(false)
	})

	it('should get adapter for all 7 platforms', () => {
		const platforms = ['instagram', 'facebook', 'whatsapp', 'tiktok', 'linkedin', 'wordpress', 'blog'] as const
		for (const platform of platforms) {
			const adapter = getPlatformAdapter(platform)
			expect(adapter.name).toBe(platform)
		}
	})
})
```

**Commit:**
```bash
git commit -m "test(phase8): add integration test for publish → engage → learn cycle"
```
