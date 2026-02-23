# Phase 8: Platform Delivery + Learning Loop — Design

## Goal

Publish generated content to 7 platforms via their APIs, collect real-time engagement metrics via webhooks, and feed results into EvoAgentX to optimize content generation per channel. The system gets smarter every cycle.

## Architecture

```
Content Generation (Phase 7)
    ↓ generated content
Publishing Adapters (7 platforms)
    ↓ publish to platforms, store platformContentId
    ↓
Platform Webhooks ← engagement events (likes, views, clicks, shares)
    ↓
Analytics Collector → engagement_events table
    ↓ broadcast SSE (engagement:received)
    ↓ threshold check (N events per content)
    ↓
EvoAgentX micro-cycle
    ↓ evaluate per-channel performance
    ↓ optimize content generation prompts
    ↓
Content Generation (next cycle — smarter prompts)
```

## Tech Stack

- OAuth 2.0 for platform connections (Meta Business SDK, LinkedIn, TikTok)
- WordPress REST API v2 for blog publishing
- Platform webhooks for real-time engagement
- EvoAgentX (existing Phase 4) for prompt optimization
- Drizzle for new schema tables

---

## 7 Publishing Adapters

| Platform | API | Auth | Publishes |
|----------|-----|------|-----------|
| Instagram | Graph API v21 | OAuth 2.0 (Meta Business) | Posts, Stories, Reels |
| Facebook | Graph API v21 | OAuth 2.0 (Meta Business) | Posts, ads |
| WhatsApp | Cloud API | OAuth 2.0 (Meta Business) | Template messages, media |
| TikTok | Marketing API v1.3 | OAuth 2.0 | Video uploads |
| LinkedIn | Marketing API | OAuth 2.0 (3-legged) | Posts, articles |
| WordPress | REST API v2 | Application Passwords | Posts, pages, media |
| Blog (generic) | Configurable webhook URL | API key header | POST JSON to any CMS |

### Shared Interface

```typescript
interface PlatformAdapter {
  name: string
  publish(content: ChannelOutput, connection: PlatformConnection): Promise<PublishResult>
  getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics>
  verifyWebhook?(payload: unknown, signature: string): boolean
}

interface PublishResult {
  platformContentId: string
  url: string
  status: 'published' | 'draft' | 'scheduled'
}

interface EngagementMetrics {
  views: number
  likes: number
  shares: number
  comments: number
  clicks: number
  saves: number
  conversions: number
}
```

---

## OAuth Flow

### Tenant Connection Flow

```
1. Tenant clicks "Connect Instagram" in settings
2. POST /api/v1/platforms/instagram/connect
3. Server redirects to Instagram OAuth URL with:
   - client_id (from env)
   - redirect_uri = https://pi.indices.app/api/v1/platforms/instagram/callback
   - scope (pages_manage_posts, instagram_basic, etc.)
4. User authorizes on Instagram
5. Instagram redirects to callback with auth code
6. Server exchanges code for access_token + refresh_token
7. Store in platform_connections table
8. Redirect back to settings page
```

### Token Refresh

Tokens are refreshed automatically when:
- Access token is expired (check `expiresAt`)
- API call returns 401
- Background job checks tokens nearing expiration

---

## DB Schema Additions

```typescript
// Platform connections — OAuth tokens per tenant
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
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// Published content — what was published where
export const publishedContent = pgTable('published_content', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  platform: text('platform').notNull(),
  channel: text('channel').notNull(),
  platformContentId: text('platform_content_id'),
  platformUrl: text('platform_url'),
  content: jsonb('content').notNull(),
  status: text('status', {
    enum: ['draft', 'published', 'scheduled', 'failed', 'deleted'],
  }).default('draft').notNull(),
  publishedAt: timestamp('published_at'),
  campaignId: uuid('campaign_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Engagement events — real-time metrics from webhooks
export const engagementEvents = pgTable('engagement_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  publishedContentId: uuid('published_content_id').notNull(),
  platform: text('platform').notNull(),
  eventType: text('event_type', {
    enum: ['view', 'like', 'share', 'comment', 'click', 'save', 'reply', 'conversion'],
  }).notNull(),
  count: integer('count').default(1).notNull(),
  metadata: jsonb('metadata').default({}),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
})
```

---

## Learning Loop — Real-time Webhook-Driven

### Flow

```
Platform webhook → /webhooks/{platform} endpoint
  → verify webhook signature
  → normalize event type (view/like/share/click/conversion)
  → store in engagement_events table
  → broadcast SSE event: engagement:received
  → aggregate total engagement for this content
  → if total > OPTIMIZATION_THRESHOLD (default 100):
      → trigger EvoAgentX micro-cycle for this channel
      → evaluate content performance vs. others on same channel
      → compute TextGrad gradient on the channel prompt
      → apply gradient to update prompt population
      → new prompt version stored
      → next content generation uses improved prompts
```

### Optimization Threshold

- Default: 100 engagement events per content piece
- Configurable per tenant in settings
- Prevents premature optimization on low-data content
- Also triggers on time-based threshold (24h after publish, regardless of volume)

### Per-Channel Prompt Evolution

The learning loop tracks metrics **per channel**:

```typescript
interface ChannelPerformance {
  channel: string
  totalContent: number
  avgEngagement: number  // weighted: views*1 + likes*2 + shares*5 + clicks*3 + conversions*10
  bestPerformingPromptId: string
  worstPerformingPromptId: string
  improvementRate: number  // % improvement over last N generations
}
```

EvoAgentX uses these metrics to:
1. **Evaluate** — score each content piece by weighted engagement
2. **Select** — pick top-performing prompts as parents
3. **Evolve** — crossover + mutate prompts (GA) or apply gradients (TextGrad)
4. **Generate** — next cycle's content uses evolved prompts

---

## API Endpoints

### Platform Connections

```
GET    /api/v1/platforms                        — list connected platforms for tenant
POST   /api/v1/platforms/:platform/connect      — initiate OAuth flow (redirect)
GET    /api/v1/platforms/:platform/callback     — OAuth callback (exchange code)
DELETE /api/v1/platforms/:platform              — disconnect platform
```

### Publishing

```
POST   /api/v1/publish                          — publish content to one platform
POST   /api/v1/publish/batch                    — publish to multiple platforms
GET    /api/v1/publish/history                  — list published content (paginated)
GET    /api/v1/publish/:id                      — get published content detail
```

### Platform Webhooks (HMAC/signature-verified, no user session)

```
POST   /webhooks/instagram                      — Instagram engagement webhook
POST   /webhooks/facebook                       — Facebook engagement webhook
POST   /webhooks/tiktok                         — TikTok engagement webhook
POST   /webhooks/linkedin                       — LinkedIn engagement webhook
GET    /webhooks/instagram                      — Meta webhook verification (challenge)
GET    /webhooks/facebook                       — Meta webhook verification (challenge)
```

### Engagement Analytics

```
GET    /api/v1/engagement/:publishedContentId   — engagement metrics for content
GET    /api/v1/engagement/summary               — aggregate metrics (by channel, time)
GET    /api/v1/engagement/leaderboard           — top performing content
```

---

## File Structure

```
src/
├── adapters/
│   └── platforms/
│       ├── types.ts           # PlatformAdapter interface, PublishResult, EngagementMetrics
│       ├── instagram.ts       # Meta Graph API adapter
│       ├── facebook.ts        # Meta Graph API adapter (shared Meta auth with Instagram)
│       ├── whatsapp.ts        # WhatsApp Cloud API adapter
│       ├── tiktok.ts          # TikTok Marketing API adapter
│       ├── linkedin.ts        # LinkedIn Marketing API adapter
│       ├── wordpress.ts       # WordPress REST API v2 adapter
│       ├── blog.ts            # Generic webhook adapter
│       ├── oauth.ts           # Shared OAuth2 flow helpers
│       └── index.ts
├── services/
│   ├── publishing/
│   │   ├── publisher.ts       # Publish orchestrator (resolve adapter, publish, store)
│   │   └── token-refresh.ts   # Token refresh logic
│   ├── engagement/
│   │   ├── collector.ts       # Normalize webhook events, store, aggregate
│   │   ├── scorer.ts          # Weighted engagement scoring
│   │   └── optimizer-trigger.ts # Threshold check → trigger EvoAgentX
│   └── evo/
│       └── channel-optimizer.ts # Per-channel prompt optimization (extends existing EvoAgentX)
├── db/schema/
│   ├── platform-connections.ts
│   ├── published-content.ts
│   └── engagement-events.ts
├── routes/
│   ├── platforms.ts           # OAuth + CRUD
│   ├── publish.ts             # Publishing endpoints
│   ├── engagement.ts          # Analytics endpoints
│   └── webhooks/
│       ├── instagram.ts       # Instagram webhook handler
│       ├── facebook.ts        # Facebook webhook handler
│       ├── tiktok.ts          # TikTok webhook handler
│       └── linkedin.ts        # LinkedIn webhook handler
```

---

## Platform-Specific Notes

### Meta (Instagram + Facebook + WhatsApp)

All three use Meta Business SDK. A single Meta OAuth flow grants access to all three based on scopes. Token is shared.

- Instagram: `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`
- Facebook: `pages_manage_posts`, `pages_read_engagement`
- WhatsApp: `whatsapp_business_messaging`

### TikTok

- OAuth 2.0 via TikTok for Developers
- Video must be uploaded first, then published
- Engagement via TikTok Marketing API webhooks

### LinkedIn

- 3-legged OAuth 2.0
- Posts via UGC Post API (`/ugcPosts`)
- Engagement via LinkedIn Marketing API analytics

### WordPress

- Application Passwords (username + app password)
- No OAuth needed — stored as metadata in platform_connections
- Supports draft/publish/scheduled status

### Blog (Generic)

- Configurable webhook URL + API key
- POST JSON body with title, content, status, tags
- No engagement pull — relies on manual metrics or UTM tracking

---

## Integration with Existing System

- **Zeluto sync** remains for email/SMS/voice campaigns (it's the execution platform for those channels)
- **Platform adapters** handle social/blog publishing (new channels)
- **Campaign model** links content → published_content → engagement for unified tracking
- **SSE events** new: `content:published`, `engagement:received`, `optimization:triggered`, `optimization:completed`
- **Analytics dashboard** adds engagement metrics to existing widgets
- **HITL** can gate publishing (approve before publish)
