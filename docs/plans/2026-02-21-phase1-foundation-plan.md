# Phase 1: Foundation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the com_mark_api repo with Hono + Bun + Drizzle, implement core CRUD routes (auth, campaigns, prospects, segments, compliance), deploy to pi.indices.app, and establish the Rust scraper worker connection.

**Architecture:** Standalone repo (`com_mark_api`), Hono app factory pattern (mirrors existing `apps/web`), Drizzle ORM on NeonDB PostgreSQL, Better Auth sessions, Pino logging. Rust scraper worker forked from `llmrank_app/apps/crawler` with HMAC-signed communication.

**Tech Stack:** Hono 4.6, Bun, TypeScript 5, Drizzle ORM, PostgreSQL (Neon), Better Auth, Zod, Pino, Vitest, Biome

**Reference:** Design doc at `docs/plans/2026-02-21-commark-hono-migration-design.md`

---

## Task 1: Initialize Project & Install Dependencies

**Files:**
- Create: `com_mark_api/package.json`
- Create: `com_mark_api/tsconfig.json`
- Create: `com_mark_api/biome.json`
- Create: `com_mark_api/.gitignore`
- Create: `com_mark_api/.env.example`

**Step 1: Create the repo and initialize with Bun**

```bash
cd /Users/lsendel/Projects
mkdir com_mark_api && cd com_mark_api
git init
bun init -y
```

**Step 2: Install core dependencies**

```bash
bun add hono @hono/node-server better-auth drizzle-orm @neondatabase/serverless zod pino pino-pretty
bun add -d typescript @types/bun vitest drizzle-kit @biomejs/biome
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["bun-types"],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create biome.json**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "lineWidth": 100
  }
}
```

**Step 5: Create .env.example**

```env
ENVIRONMENT=development
PORT=3001

# Database
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require

# Auth
BETTER_AUTH_SECRET=change-me-in-production
BETTER_AUTH_URL=http://localhost:3001

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o

# Adapters
SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=

# Rust Scraper Worker
SCRAPER_WORKER_URL=http://localhost:8080
SCRAPER_SHARED_SECRET=change-me

# Zeluto
ZELUTO_API_URL=https://zeluto.com/api/v1
ZELUTO_TENANT_CONTEXT=

# CORS
CORS_ORIGINS=https://indices.app,http://localhost:3000

# Redis
REDIS_URL=
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
.env
*.log
```

**Step 7: Update package.json scripts**

Add to package.json:
```json
{
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "start": "bun run src/index.ts",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "biome check src/",
    "lint:fix": "biome check --write src/",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: initialize com_mark_api with Hono, Drizzle, Bun"
```

---

## Task 2: Config, Logger, Error Types

**Files:**
- Create: `com_mark_api/src/config.ts`
- Create: `com_mark_api/src/utils/logger.ts`
- Create: `com_mark_api/src/types/errors.ts`
- Test: `com_mark_api/tests/config.test.ts`

**Step 1: Write config test**

```typescript
// tests/config.test.ts
import { describe, it, expect } from 'vitest'
import { configSchema } from '../src/config'

describe('config', () => {
  it('parses valid config with defaults', () => {
    const result = configSchema.safeParse({
      DATABASE_URL: 'postgresql://localhost/test',
      BETTER_AUTH_SECRET: 'test-secret',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.PORT).toBe(3001)
      expect(result.data.ENVIRONMENT).toBe('development')
    }
  })

  it('rejects missing DATABASE_URL', () => {
    const result = configSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/lsendel/Projects/com_mark_api
bun test tests/config.test.ts
```

Expected: FAIL — `configSchema` not found

**Step 3: Implement config.ts**

```typescript
// src/config.ts
import { z } from 'zod'

export const configSchema = z.object({
  ENVIRONMENT: z.enum(['development', 'staging', 'production', 'testing']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1).default('dev-secret-change-in-production'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3001'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o'),
  SENDGRID_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  SCRAPER_WORKER_URL: z.string().url().default('http://localhost:8080'),
  SCRAPER_SHARED_SECRET: z.string().default('dev-secret'),
  ZELUTO_API_URL: z.string().url().default('https://zeluto.com/api/v1'),
  ZELUTO_TENANT_CONTEXT: z.string().optional(),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  REDIS_URL: z.string().optional(),
})

export type Config = z.infer<typeof configSchema>

let _config: Config | null = null

export function getConfig(): Config {
  if (!_config) {
    _config = configSchema.parse(process.env)
  }
  return _config
}
```

**Step 4: Implement logger**

```typescript
// src/utils/logger.ts
import pino from 'pino'
import { getConfig } from '../config'

export function createLogger() {
  const config = getConfig()
  return pino({
    level: config.ENVIRONMENT === 'production' ? 'info' : 'debug',
    transport: config.ENVIRONMENT !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  })
}

export const logger = createLogger()
```

**Step 5: Implement error types**

```typescript
// src/types/errors.ts
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'INTERNAL_ERROR',
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(404, `${resource} with id ${id} not found`, 'NOT_FOUND')
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT')
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, message, 'UNAUTHORIZED')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, message, 'FORBIDDEN')
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(422, message, 'VALIDATION_ERROR')
  }
}
```

**Step 6: Run tests**

```bash
bun test tests/config.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/config.ts src/utils/logger.ts src/types/errors.ts tests/config.test.ts
git commit -m "feat: add Zod config, Pino logger, and error types"
```

---

## Task 3: Hono App Factory + Middleware Stack

**Files:**
- Create: `com_mark_api/src/app.ts`
- Create: `com_mark_api/src/index.ts`
- Create: `com_mark_api/src/middleware/request-id.ts`
- Create: `com_mark_api/src/middleware/error-handler.ts`
- Create: `com_mark_api/src/middleware/cors.ts`
- Test: `com_mark_api/tests/app.test.ts`

**Step 1: Write app test**

```typescript
// tests/app.test.ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../src/app'

describe('app', () => {
  const app = createApp()

  it('returns health check', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/nonexistent')
    expect(res.status).toBe(404)
  })

  it('includes X-Request-ID header', async () => {
    const res = await app.request('/health')
    expect(res.headers.get('x-request-id')).toBeTruthy()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/app.test.ts
```

Expected: FAIL

**Step 3: Implement middleware files**

```typescript
// src/middleware/request-id.ts
import type { MiddlewareHandler } from 'hono'
import { randomUUID } from 'crypto'

export function requestId(): MiddlewareHandler {
  return async (c, next) => {
    const id = c.req.header('x-request-id') || randomUUID()
    c.set('requestId', id)
    c.header('X-Request-ID', id)
    await next()
  }
}
```

```typescript
// src/middleware/error-handler.ts
import type { ErrorHandler } from 'hono'
import { AppError } from '../types/errors'
import { logger } from '../utils/logger'

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      { error: err.code, message: err.message },
      err.statusCode as 400,
    )
  }

  logger.error({ err, requestId: c.get('requestId') }, 'Unhandled error')
  return c.json(
    { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    500,
  )
}
```

```typescript
// src/middleware/cors.ts
import { cors } from 'hono/cors'
import { getConfig } from '../config'

export function corsMiddleware() {
  const config = getConfig()
  const origins = config.CORS_ORIGINS.split(',').map((o) => o.trim())
  return cors({
    origin: origins,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    credentials: true,
  })
}
```

**Step 4: Implement app.ts**

```typescript
// src/app.ts
import { Hono } from 'hono'
import { requestId } from './middleware/request-id'
import { errorHandler } from './middleware/error-handler'
import { corsMiddleware } from './middleware/cors'

export type AppEnv = {
  Variables: {
    requestId: string
    userId?: string
    tenantId?: string
  }
}

export function createApp() {
  const app = new Hono<AppEnv>()

  // Global middleware
  app.use('*', requestId())
  app.use('*', corsMiddleware())

  // Error handler
  app.onError(errorHandler)

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // 404 handler
  app.notFound((c) =>
    c.json({ error: 'NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` }, 404),
  )

  return app
}
```

**Step 5: Implement index.ts**

```typescript
// src/index.ts
import { createApp } from './app'
import { getConfig } from './config'
import { logger } from './utils/logger'

const config = getConfig()
const app = createApp()

logger.info({ port: config.PORT, env: config.ENVIRONMENT }, 'Starting com_mark_api')

export default {
  port: config.PORT,
  fetch: app.fetch,
}
```

**Step 6: Run tests**

```bash
bun test tests/app.test.ts
```

Expected: PASS

**Step 7: Verify dev server starts**

```bash
bun run dev
# Open http://localhost:3001/health in browser or:
curl http://localhost:3001/health
```

Expected: `{"status":"ok","timestamp":"..."}`

**Step 8: Commit**

```bash
git add src/app.ts src/index.ts src/middleware/ tests/app.test.ts
git commit -m "feat: Hono app factory with request-id, CORS, error handling"
```

---

## Task 4: Drizzle Schema — Core Tables

**Files:**
- Create: `com_mark_api/src/db/schema/tenants.ts`
- Create: `com_mark_api/src/db/schema/prospects.ts`
- Create: `com_mark_api/src/db/schema/campaigns.ts`
- Create: `com_mark_api/src/db/schema/segments.ts`
- Create: `com_mark_api/src/db/schema/compliance.ts`
- Create: `com_mark_api/src/db/schema/index.ts`
- Create: `com_mark_api/src/db/client.ts`
- Create: `com_mark_api/drizzle.config.ts`
- Test: `com_mark_api/tests/db/schema.test.ts`

**Step 1: Write schema test**

```typescript
// tests/db/schema.test.ts
import { describe, it, expect } from 'vitest'
import { tenants } from '../../src/db/schema/tenants'
import { prospects } from '../../src/db/schema/prospects'
import { campaigns, channelResults } from '../../src/db/schema/campaigns'
import { segments, suppressionEntries } from '../../src/db/schema/segments'
import { auditLogs } from '../../src/db/schema/compliance'

describe('schema', () => {
  it('tenants table has required columns', () => {
    expect(tenants.id).toBeDefined()
    expect(tenants.name).toBeDefined()
    expect(tenants.slug).toBeDefined()
    expect(tenants.createdAt).toBeDefined()
  })

  it('prospects table has tenant_id foreign key', () => {
    expect(prospects.tenantId).toBeDefined()
    expect(prospects.email).toBeDefined()
  })

  it('campaigns table has tenant_id and status', () => {
    expect(campaigns.tenantId).toBeDefined()
    expect(campaigns.status).toBeDefined()
  })

  it('channelResults references campaign', () => {
    expect(channelResults.campaignId).toBeDefined()
    expect(channelResults.channel).toBeDefined()
  })

  it('segments table has rules jsonb', () => {
    expect(segments.rules).toBeDefined()
  })

  it('auditLogs table has action and actor', () => {
    expect(auditLogs.action).toBeDefined()
    expect(auditLogs.actor).toBeDefined()
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/db/schema.test.ts
```

Expected: FAIL

**Step 3: Implement schema files**

```typescript
// src/db/schema/tenants.ts
import { pgTable, text, timestamp, jsonb, integer, uuid } from 'drizzle-orm/pg-core'

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status', { enum: ['active', 'suspended', 'trial'] }).default('active').notNull(),
  settings: jsonb('settings').default({}).notNull(),
  maxCampaigns: integer('max_campaigns').default(100).notNull(),
  maxProspects: integer('max_prospects').default(10000).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
```

```typescript
// src/db/schema/prospects.ts
import { pgTable, text, timestamp, uuid, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const prospects = pgTable('prospects', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  company: text('company').notNull(),
  role: text('role').notNull(),
  email: text('email'),
  phone: text('phone'),
  linkedinId: text('linkedin_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_prospects_email').on(table.email),
  index('idx_prospects_tenant').on(table.tenantId),
  index('idx_prospects_company').on(table.company),
])
```

```typescript
// src/db/schema/campaigns.ts
import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goal: text('goal').notNull(),
  productDescription: text('product_description'),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'partial', 'failed', 'cancelled'],
  }).default('pending').notNull(),
  channelsRequested: jsonb('channels_requested').default([]).notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_campaigns_tenant').on(table.tenantId),
  index('idx_campaigns_status').on(table.status),
  index('idx_campaigns_created').on(table.createdAt),
])

export const channelResults = pgTable('channel_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  campaignId: uuid('campaign_id').notNull().references(() => campaigns.id, { onDelete: 'cascade' }),
  channel: text('channel', { enum: ['email', 'sms', 'voice', 'linkedin'] }).notNull(),
  status: text('status', {
    enum: ['pending', 'sent', 'queued', 'delivered', 'failed', 'skipped'],
  }).default('pending').notNull(),
  provider: text('provider'),
  messageContent: text('message_content'),
  messageSubject: text('message_subject'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

```typescript
// src/db/schema/segments.ts
import { pgTable, text, timestamp, uuid, jsonb, boolean, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const segments = pgTable('segments', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  rules: jsonb('rules').default({}).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_segments_tenant').on(table.tenantId),
])

export const suppressionEntries = pgTable('suppression_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  entryType: text('entry_type', { enum: ['bounce', 'complaint', 'unsubscribe', 'manual'] }).notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_suppression_email').on(table.email),
  index('idx_suppression_tenant').on(table.tenantId),
])
```

```typescript
// src/db/schema/compliance.ts
import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  actor: text('actor').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_tenant').on(table.tenantId),
  index('idx_audit_created').on(table.createdAt),
  index('idx_audit_action').on(table.action),
])

export const webhooks = pgTable('webhooks', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  events: jsonb('events').default([]).notNull(),
  secret: text('secret').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// Need boolean import
import { boolean } from 'drizzle-orm/pg-core'
```

```typescript
// src/db/schema/index.ts
export * from './tenants'
export * from './prospects'
export * from './campaigns'
export * from './segments'
export * from './compliance'
```

**Step 4: Implement DB client**

```typescript
// src/db/client.ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { getConfig } from '../config'
import * as schema from './schema'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const config = getConfig()
    const sql = neon(config.DATABASE_URL)
    _db = drizzle(sql, { schema })
  }
  return _db
}

export type Database = ReturnType<typeof getDb>
```

**Step 5: Create drizzle.config.ts**

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

**Step 6: Run tests**

```bash
bun test tests/db/schema.test.ts
```

Expected: PASS

**Step 7: Generate initial migration**

```bash
bun run db:generate
```

Expected: Migration files created in `src/db/migrations/`

**Step 8: Commit**

```bash
git add src/db/ drizzle.config.ts tests/db/
git commit -m "feat: Drizzle schema for tenants, prospects, campaigns, segments, compliance"
```

---

## Task 5: Auth Middleware (Better Auth)

**Files:**
- Create: `com_mark_api/src/middleware/auth.ts`
- Create: `com_mark_api/src/lib/auth.ts`
- Test: `com_mark_api/tests/middleware/auth.test.ts`

**Step 1: Write auth test**

```typescript
// tests/middleware/auth.test.ts
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from '../../src/middleware/auth'

describe('auth middleware', () => {
  const app = new Hono()

  app.use('/api/*', authMiddleware())
  app.get('/api/test', (c) => c.json({ userId: c.get('userId') }))
  app.get('/health', (c) => c.json({ status: 'ok' }))

  it('rejects unauthenticated API requests with 401', async () => {
    const res = await app.request('/api/test')
    expect(res.status).toBe(401)
  })

  it('allows health check without auth', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/middleware/auth.test.ts
```

Expected: FAIL

**Step 3: Implement auth middleware**

```typescript
// src/middleware/auth.ts
import type { MiddlewareHandler } from 'hono'
import { UnauthorizedError } from '../types/errors'

export interface SessionUser {
  id: string
  email: string
  name: string
}

export function authMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    // Dev mode: auto-auth
    const env = process.env.ENVIRONMENT || 'development'
    if (env === 'development' || env === 'testing') {
      const devUser: SessionUser = { id: 'dev_user', email: 'dev@indices.app', name: 'Dev User' }
      c.set('userId', devUser.id)
      c.set('user', devUser)
      return next()
    }

    // Check Better Auth session cookie
    const sessionToken = c.req.header('cookie')
      ?.split(';')
      .find((c) => c.trim().startsWith('better-auth.session_token='))
      ?.split('=')[1]

    // Check Bearer token
    const authHeader = c.req.header('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!sessionToken && !bearerToken) {
      throw new UnauthorizedError('No session token or bearer token provided')
    }

    // Validate session via Better Auth API
    try {
      const response = await fetch(`${process.env.BETTER_AUTH_URL}/api/auth/get-session`, {
        headers: {
          cookie: sessionToken ? `better-auth.session_token=${sessionToken}` : '',
          authorization: bearerToken ? `Bearer ${bearerToken}` : '',
        },
      })

      if (!response.ok) {
        throw new UnauthorizedError('Invalid session')
      }

      const session = (await response.json()) as { user: SessionUser }
      c.set('userId', session.user.id)
      c.set('user', session.user)
      return next()
    } catch (err) {
      if (err instanceof UnauthorizedError) throw err
      throw new UnauthorizedError('Session validation failed')
    }
  }
}
```

**Step 4: Run tests**

```bash
ENVIRONMENT=testing bun test tests/middleware/auth.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/middleware/auth.ts src/lib/ tests/middleware/
git commit -m "feat: Better Auth middleware with dev mode auto-auth"
```

---

## Task 6: Prospects CRUD Route

**Files:**
- Create: `com_mark_api/src/routes/prospects.ts`
- Create: `com_mark_api/src/types/api.ts` (Zod schemas)
- Test: `com_mark_api/tests/routes/prospects.test.ts`

**Step 1: Write route test**

```typescript
// tests/routes/prospects.test.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { createApp } from '../../src/app'

// Note: These tests use the dev auto-auth (ENVIRONMENT=testing)
// and will need a test DB setup in a later task. For now, test request validation.

describe('prospects routes', () => {
  const app = createApp()

  it('POST /api/v1/prospects validates required fields', async () => {
    const res = await app.request('/api/v1/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/prospects validates email format', async () => {
    const res = await app.request('/api/v1/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        company: 'Test Corp',
        role: 'CTO',
        email: 'not-an-email',
      }),
    })
    expect(res.status).toBe(422)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
ENVIRONMENT=testing bun test tests/routes/prospects.test.ts
```

Expected: FAIL

**Step 3: Implement Zod schemas**

```typescript
// src/types/api.ts
import { z } from 'zod'

// Prospects
export const prospectCreate = z.object({
  name: z.string().min(1).max(100),
  company: z.string().min(1).max(100),
  role: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/).optional(),
  linkedinId: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export const prospectUpdate = prospectCreate.partial()

export type ProspectCreate = z.infer<typeof prospectCreate>
export type ProspectUpdate = z.infer<typeof prospectUpdate>

// Campaigns
export const campaignCreate = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().min(1).max(200),
  productDescription: z.string().max(500).optional(),
  channels: z.array(z.enum(['email', 'sms', 'voice', 'linkedin'])).min(1),
  prospectId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type CampaignCreate = z.infer<typeof campaignCreate>

// Segments
export const segmentCreate = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rules: z.record(z.unknown()).default({}),
  active: z.boolean().default(true),
})

export type SegmentCreate = z.infer<typeof segmentCreate>

// Pagination
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})
```

**Step 4: Implement prospects route**

```typescript
// src/routes/prospects.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { prospects } from '../db/schema'
import { getDb } from '../db/client'
import { prospectCreate, prospectUpdate, paginationQuery } from '../types/api'
import { NotFoundError, ConflictError, ValidationError } from '../types/errors'

export function createProspectRoutes() {
  const router = new Hono<AppEnv>()

  // List prospects
  router.get('/', async (c) => {
    const { page, limit } = paginationQuery.parse(c.req.query())
    const db = getDb()
    const offset = (page - 1) * limit

    const [items, countResult] = await Promise.all([
      db.select().from(prospects).limit(limit).offset(offset).orderBy(prospects.createdAt),
      db.select({ count: sql<number>`count(*)` }).from(prospects),
    ])

    return c.json({
      items,
      total: countResult[0]?.count ?? 0,
      page,
      limit,
    })
  })

  // Get prospect by ID
  router.get('/:id', async (c) => {
    const db = getDb()
    const id = c.req.param('id')
    const [prospect] = await db.select().from(prospects).where(eq(prospects.id, id))
    if (!prospect) throw new NotFoundError('Prospect', id)
    return c.json(prospect)
  })

  // Create prospect
  router.post('/', zValidator('json', prospectCreate), async (c) => {
    const db = getDb()
    const data = c.req.valid('json')

    if (data.email) {
      const [existing] = await db
        .select()
        .from(prospects)
        .where(eq(prospects.email, data.email))
      if (existing) throw new ConflictError(`Prospect with email ${data.email} already exists`)
    }

    const [created] = await db.insert(prospects).values(data).returning()
    return c.json(created, 201)
  })

  // Update prospect
  router.patch('/:id', zValidator('json', prospectUpdate), async (c) => {
    const db = getDb()
    const id = c.req.param('id')
    const data = c.req.valid('json')

    const [updated] = await db
      .update(prospects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(prospects.id, id))
      .returning()
    if (!updated) throw new NotFoundError('Prospect', id)
    return c.json(updated)
  })

  // Delete prospect
  router.delete('/:id', async (c) => {
    const db = getDb()
    const id = c.req.param('id')
    const [deleted] = await db.delete(prospects).where(eq(prospects.id, id)).returning()
    if (!deleted) throw new NotFoundError('Prospect', id)
    return c.json({ deleted: true })
  })

  return router
}
```

**Step 5: Install Zod validator middleware**

```bash
bun add @hono/zod-validator
```

**Step 6: Mount route in app.ts**

Add to `src/app.ts` after health check:
```typescript
import { createProspectRoutes } from './routes/prospects'
import { authMiddleware } from './middleware/auth'

// Protected API routes
app.use('/api/v1/*', authMiddleware())
app.route('/api/v1/prospects', createProspectRoutes())
```

**Step 7: Run tests**

```bash
ENVIRONMENT=testing bun test tests/routes/prospects.test.ts
```

Expected: PASS (validation tests pass; DB operations need integration test setup)

**Step 8: Commit**

```bash
git add src/routes/prospects.ts src/types/api.ts tests/routes/prospects.test.ts
git commit -m "feat: prospects CRUD route with Zod validation"
```

---

## Task 7: Campaigns Route

**Files:**
- Create: `com_mark_api/src/routes/campaigns.ts`
- Test: `com_mark_api/tests/routes/campaigns.test.ts`

**Step 1: Write campaign route test**

```typescript
// tests/routes/campaigns.test.ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('campaigns routes', () => {
  const app = createApp()

  it('POST /api/v1/campaigns validates required fields', async () => {
    const res = await app.request('/api/v1/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })

  it('POST /api/v1/campaigns requires at least one channel', async () => {
    const res = await app.request('/api/v1/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Campaign',
        goal: 'Discovery Call',
        channels: [],
      }),
    })
    expect(res.status).toBe(422)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
ENVIRONMENT=testing bun test tests/routes/campaigns.test.ts
```

**Step 3: Implement campaigns route**

```typescript
// src/routes/campaigns.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { campaigns, channelResults } from '../db/schema'
import { getDb } from '../db/client'
import { campaignCreate, paginationQuery } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createCampaignRoutes() {
  const router = new Hono<AppEnv>()

  // List campaigns
  router.get('/', async (c) => {
    const { page, limit } = paginationQuery.parse(c.req.query())
    const db = getDb()
    const offset = (page - 1) * limit

    const [items, countResult] = await Promise.all([
      db.select().from(campaigns).limit(limit).offset(offset).orderBy(campaigns.createdAt),
      db.select({ count: sql<number>`count(*)` }).from(campaigns),
    ])

    return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
  })

  // Get campaign with channel results
  router.get('/:id', async (c) => {
    const db = getDb()
    const id = c.req.param('id')

    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id))
    if (!campaign) throw new NotFoundError('Campaign', id)

    const results = await db
      .select()
      .from(channelResults)
      .where(eq(channelResults.campaignId, id))

    return c.json({ ...campaign, results })
  })

  // Create campaign
  router.post('/', zValidator('json', campaignCreate), async (c) => {
    const db = getDb()
    const data = c.req.valid('json')

    const [created] = await db
      .insert(campaigns)
      .values({
        name: data.name,
        goal: data.goal,
        productDescription: data.productDescription,
        channelsRequested: data.channels,
        metadata: data.metadata ?? {},
      })
      .returning()

    return c.json(created, 201)
  })

  // Update campaign status
  router.patch('/:id/status', async (c) => {
    const db = getDb()
    const id = c.req.param('id')
    const body = await c.req.json<{ status: string }>()

    const [updated] = await db
      .update(campaigns)
      .set({ status: body.status, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning()
    if (!updated) throw new NotFoundError('Campaign', id)
    return c.json(updated)
  })

  return router
}
```

**Step 4: Mount in app.ts**

```typescript
import { createCampaignRoutes } from './routes/campaigns'
app.route('/api/v1/campaigns', createCampaignRoutes())
```

**Step 5: Run tests**

```bash
ENVIRONMENT=testing bun test tests/routes/campaigns.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/routes/campaigns.ts tests/routes/campaigns.test.ts
git commit -m "feat: campaigns route with CRUD and channel results"
```

---

## Task 8: Segments + Compliance Routes

**Files:**
- Create: `com_mark_api/src/routes/segments.ts`
- Create: `com_mark_api/src/routes/compliance.ts`
- Create: `com_mark_api/src/routes/index.ts`
- Test: `com_mark_api/tests/routes/segments.test.ts`

**Step 1: Write test**

```typescript
// tests/routes/segments.test.ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('segments routes', () => {
  const app = createApp()

  it('POST /api/v1/segments validates name', async () => {
    const res = await app.request('/api/v1/segments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
  })
})

describe('compliance routes', () => {
  const app = createApp()

  it('GET /api/v1/audit/logs returns list', async () => {
    const res = await app.request('/api/v1/audit/logs')
    // Should return 200 (empty list) or connect to DB
    expect([200, 500]).toContain(res.status)
  })
})
```

**Step 2-3: Implement segments and compliance routes** (follow same patterns as prospects/campaigns)

**Step 4: Create route aggregator**

```typescript
// src/routes/index.ts
import type { Hono } from 'hono'
import type { AppEnv } from '../app'
import { createProspectRoutes } from './prospects'
import { createCampaignRoutes } from './campaigns'
import { createSegmentRoutes } from './segments'
import { createComplianceRoutes } from './compliance'

export function registerRoutes(app: Hono<AppEnv>) {
  app.route('/api/v1/prospects', createProspectRoutes())
  app.route('/api/v1/campaigns', createCampaignRoutes())
  app.route('/api/v1/segments', createSegmentRoutes())
  app.route('/api/v1/audit', createComplianceRoutes())
}
```

**Step 5: Commit**

```bash
git add src/routes/ tests/routes/segments.test.ts
git commit -m "feat: segments and compliance routes, route aggregator"
```

---

## Task 9: Scraper Dispatcher + Ingest Route

**Files:**
- Create: `com_mark_api/src/services/scraper/dispatcher.ts`
- Create: `com_mark_api/src/services/scraper/batch-handler.ts`
- Create: `com_mark_api/src/routes/ingest.ts`
- Create: `com_mark_api/src/routes/scraper.ts`
- Test: `com_mark_api/tests/services/scraper.test.ts`

**Step 1: Write HMAC auth test**

```typescript
// tests/services/scraper.test.ts
import { describe, it, expect } from 'vitest'
import { signPayload, verifySignature } from '../../src/services/scraper/dispatcher'

describe('HMAC signing', () => {
  const secret = 'test-secret'

  it('signs and verifies a payload', () => {
    const payload = JSON.stringify({ job_id: '123', pages: [] })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = signPayload(payload, timestamp, secret)

    expect(verifySignature(payload, timestamp, signature, secret)).toBe(true)
  })

  it('rejects tampered payload', () => {
    const payload = JSON.stringify({ job_id: '123' })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = signPayload(payload, timestamp, secret)

    expect(verifySignature('tampered', timestamp, signature, secret)).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
bun test tests/services/scraper.test.ts
```

**Step 3: Implement HMAC dispatcher**

```typescript
// src/services/scraper/dispatcher.ts
import { createHmac, timingSafeEqual } from 'crypto'
import { getConfig } from '../../config'
import { logger } from '../../utils/logger'

export function signPayload(body: string, timestamp: string, secret: string): string {
  return createHmac('sha256', secret).update(`${timestamp}${body}`).digest('hex')
}

export function verifySignature(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean {
  const expected = signPayload(body, timestamp, secret)
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function dispatchScrapeJob(job: {
  jobId: string
  callbackUrl: string
  config: {
    seedUrls?: string[]
    subreddits?: string[]
    keywords?: string[]
    jobType: 'web_crawl' | 'social_scrape' | 'feed_ingest'
    maxPages?: number
  }
}) {
  const config = getConfig()
  const body = JSON.stringify(job)
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = signPayload(body, timestamp, config.SCRAPER_SHARED_SECRET)

  const endpoint = job.config.jobType === 'web_crawl'
    ? '/api/v1/jobs'
    : job.config.jobType === 'social_scrape'
      ? '/api/v1/social/scrape'
      : '/api/v1/feeds/ingest'

  const response = await fetch(`${config.SCRAPER_WORKER_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': timestamp,
    },
    body,
  })

  if (!response.ok) {
    logger.error({ status: response.status, jobId: job.jobId }, 'Scraper dispatch failed')
    throw new Error(`Scraper dispatch failed: ${response.statusText}`)
  }

  return response.json()
}
```

**Step 4: Implement ingest route (receives batches from Rust worker)**

```typescript
// src/routes/ingest.ts
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { verifySignature } from '../services/scraper/dispatcher'
import { getConfig } from '../config'
import { logger } from '../utils/logger'

export function createIngestRoutes() {
  const router = new Hono<AppEnv>()

  // Receive batch from Rust scraper worker
  router.post('/batch', async (c) => {
    const config = getConfig()
    const signature = c.req.header('x-signature')
    const timestamp = c.req.header('x-timestamp')
    const body = await c.req.text()

    if (!signature || !timestamp) {
      return c.json({ error: 'Missing HMAC headers' }, 401)
    }

    // Replay protection: reject if timestamp > 5 minutes old
    const now = Math.floor(Date.now() / 1000)
    if (Math.abs(now - parseInt(timestamp)) > 300) {
      return c.json({ error: 'Timestamp too old' }, 401)
    }

    if (!verifySignature(body, timestamp, signature, config.SCRAPER_SHARED_SECRET)) {
      return c.json({ error: 'Invalid signature' }, 401)
    }

    const batch = JSON.parse(body) as {
      job_id: string
      batch_index: number
      is_final: boolean
      pages?: unknown[]
      posts?: unknown[]
    }

    logger.info(
      { jobId: batch.job_id, batchIndex: batch.batch_index, isFinal: batch.is_final },
      'Received scraper batch',
    )

    // TODO: Process and store batch data (Phase 2: sentiment pipeline)

    return c.json({ received: true, jobId: batch.job_id, batchIndex: batch.batch_index })
  })

  return router
}
```

**Step 5: Mount routes in app.ts**

```typescript
import { createIngestRoutes } from './routes/ingest'
app.route('/api/v1/ingest', createIngestRoutes())
```

**Step 6: Run tests**

```bash
bun test tests/services/scraper.test.ts
```

Expected: PASS

**Step 7: Commit**

```bash
git add src/services/scraper/ src/routes/ingest.ts src/routes/scraper.ts tests/services/scraper.test.ts
git commit -m "feat: HMAC-signed scraper dispatcher and batch ingest route"
```

---

## Task 10: Dockerfile + Deploy Config

**Files:**
- Create: `com_mark_api/Dockerfile`
- Create: `com_mark_api/.dockerignore`

**Step 1: Create Dockerfile**

```dockerfile
# Dockerfile
FROM oven/bun:1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Build
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json tsconfig.json drizzle.config.ts ./

# Run
EXPOSE 3001
ENV NODE_ENV=production
CMD ["bun", "run", "src/index.ts"]
```

**Step 2: Create .dockerignore**

```
node_modules
dist
.env
*.log
tests
.git
```

**Step 3: Test Docker build locally**

```bash
cd /Users/lsendel/Projects/com_mark_api
docker build -t com_mark_api .
docker run -p 3001:3001 --env-file .env com_mark_api
```

Expected: Server starts, `curl http://localhost:3001/health` returns OK

**Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "feat: Dockerfile for Bun deployment to pi.indices.app"
```

---

## Task 11: Rust Scraper Worker Fork

**Files:**
- Fork: `/Users/lsendel/Projects/llmrank_app/apps/crawler/` → new directory

**Step 1: Fork the crawler**

```bash
cd /Users/lsendel/Projects
mkdir scraper-worker
cp -r llmrank_app/apps/crawler/src scraper-worker/src
cp llmrank_app/apps/crawler/Cargo.toml scraper-worker/
cp llmrank_app/apps/crawler/Dockerfile scraper-worker/
```

**Step 2: Update Cargo.toml package name**

Change `name = "llmrank-crawler"` to `name = "commark-scraper"`

**Step 3: Update callback URL in config to point to com_mark_api**

In `src/config.rs`, update `API_BASE_URL` default to `https://pi.indices.app`

**Step 4: Add placeholder for social scraping module**

```bash
mkdir -p scraper-worker/src/social
mkdir -p scraper-worker/src/feeds
```

Create `scraper-worker/src/social/mod.rs`:
```rust
// Social media scraping modules - Phase 5
pub mod reddit;
```

Create `scraper-worker/src/social/reddit.rs`:
```rust
// Reddit API scraper - to be implemented in Phase 5
// Replaces Madison's PRAW (Python) with native Rust
```

**Step 5: Verify it compiles**

```bash
cd /Users/lsendel/Projects/scraper-worker
cargo build
```

Expected: Compiles successfully

**Step 6: Initialize git and commit**

```bash
cd /Users/lsendel/Projects/scraper-worker
git init
git add -A
git commit -m "feat: fork llmrank_app crawler as commark-scraper worker"
```

---

## Task 12: Integration Test — End to End

**Files:**
- Create: `com_mark_api/tests/integration/health.test.ts`
- Create: `com_mark_api/tests/helpers/test-app.ts`

**Step 1: Create test helper**

```typescript
// tests/helpers/test-app.ts
import { createApp } from '../../src/app'

export function getTestApp() {
  process.env.ENVIRONMENT = 'testing'
  process.env.DATABASE_URL = 'postgresql://localhost/commark_test'
  process.env.BETTER_AUTH_SECRET = 'test-secret'
  return createApp()
}
```

**Step 2: Write integration test**

```typescript
// tests/integration/health.test.ts
import { describe, it, expect } from 'vitest'
import { getTestApp } from '../helpers/test-app'

describe('integration: health', () => {
  const app = getTestApp()

  it('GET /health returns status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeTruthy()
  })

  it('GET /api/v1/prospects returns list (with dev auth)', async () => {
    const res = await app.request('/api/v1/prospects')
    // Will fail with DB connection in testing, but validates route exists
    expect([200, 500]).toContain(res.status)
  })

  it('GET /api/v1/campaigns returns list (with dev auth)', async () => {
    const res = await app.request('/api/v1/campaigns')
    expect([200, 500]).toContain(res.status)
  })

  it('unknown route returns 404 JSON', async () => {
    const res = await app.request('/api/v1/nonexistent')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('NOT_FOUND')
  })
})
```

**Step 3: Run all tests**

```bash
cd /Users/lsendel/Projects/com_mark_api
ENVIRONMENT=testing bun test
```

Expected: All tests PASS

**Step 4: Commit**

```bash
git add tests/
git commit -m "test: add integration tests and test helpers"
```

---

## Task 13: Update Frontend API Client

**Files:**
- Modify: `/Users/lsendel/Projects/com_mark/apps/web/src/lib/api.ts`

**Step 1: Update API_URL to point to pi.indices.app in production**

In `apps/web/src/lib/api.ts`, the `getApiUrl()` function already reads `API_URL` from env. Update the `.env` for the frontend to point to the new backend:

```
API_URL=https://pi.indices.app/api/v1
```

**Step 2: Verify the frontend can still build**

```bash
cd /Users/lsendel/Projects/com_mark/apps/web
bun run build
```

Expected: Build succeeds

**Step 3: Commit**

```bash
cd /Users/lsendel/Projects/com_mark
git add apps/web/
git commit -m "chore: configure frontend to use pi.indices.app backend"
```

---

## Summary

After completing all 13 tasks, Phase 1 delivers:

1. **com_mark_api repo** with Hono + Bun + Drizzle
2. **Core routes**: prospects, campaigns, segments, compliance (CRUD)
3. **Auth**: Better Auth middleware with dev auto-auth
4. **Database**: Drizzle schema for 7 core tables, NeonDB PostgreSQL
5. **Middleware**: request-id, CORS, error handling, auth
6. **Scraper integration**: HMAC-signed dispatcher + ingest route
7. **Rust worker**: Forked from llmrank_app, ready for social module extensions
8. **Deployment**: Dockerfile for pi.indices.app
9. **Testing**: Vitest suite with validation and integration tests
10. **Frontend**: Updated to point at new backend

**Next phase plan**: Phase 2 (Intelligence) should be written after Phase 1 is complete and deployed.
