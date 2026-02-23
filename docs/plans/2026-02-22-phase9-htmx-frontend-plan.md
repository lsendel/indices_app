# Phase 9: HTMX Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a server-rendered HTMX frontend on Cloudflare Workers (`app.indices.app`) with 10 DDD-organized bounded contexts, ts-rest API contract, and real-time SSE integration.

**Architecture:** Thin Proxy pattern — CF Worker receives browser requests, fetches JSON from `pi.indices.app` via ts-rest client, renders Hono JSX to HTML. HTMX swaps partial HTML fragments. SSE proxied through the Worker.

**Tech Stack:** Hono 4 (JSX), HTMX, ts-rest, Tailwind CSS, D3.js + dagre, Chart.js, Vitest, Playwright, wrangler

**Three projects:**
1. `@indices/contract` — shared ts-rest contract NPM package (new, at `/Users/lsendel/Projects/indices_contract/`)
2. `indices_frontend` — HTMX frontend on CF Workers (new, at `/Users/lsendel/Projects/indices_frontend/`)
3. `indices_app` — backend refactored to import from `@indices/contract` (existing)

**Design doc:** `docs/plans/2026-02-22-htmx-frontend-design.md`

**Backend reference:**
- API at `http://localhost:3001` (dev) / `https://pi.indices.app` (prod)
- 60+ endpoints across 19 route files
- Auth: `better-auth.session_token` cookie → `BETTER_AUTH_URL/api/auth/get-session`
- SSE: `GET /api/v1/sse/stream` (tenant-scoped, heartbeat every 30s)
- CORS: `credentials: true`, origins configurable via `CORS_ORIGINS`

---

## Task 1: Scaffold `@indices/contract` Package

**Files:**
- Create: `/Users/lsendel/Projects/indices_contract/package.json`
- Create: `/Users/lsendel/Projects/indices_contract/tsconfig.json`
- Create: `/Users/lsendel/Projects/indices_contract/src/index.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/shared.ts`
- Test: `/Users/lsendel/Projects/indices_contract/src/__tests__/shared.test.ts`

**Step 1: Create directory and init**

```bash
mkdir -p /Users/lsendel/Projects/indices_contract/src/__tests__
cd /Users/lsendel/Projects/indices_contract
git init
```

**Step 2: Create package.json**

```json
{
  "name": "@indices/contract",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest",
    "test:run": "vitest run",
    "prepublishOnly": "tsc"
  },
  "dependencies": {
    "@ts-rest/core": "^3.51.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^4.0.18"
  },
  "peerDependencies": {
    "zod": ">=3.20.0"
  }
}
```

Note: ts-rest v3.x uses `zod` v3.x. The backend uses `zod` v4.3.6 — check compatibility. If ts-rest supports zod v4 at time of implementation, use `"zod": "^4.3.6"` instead. Otherwise pin to zod v3 in the contract and use `zod` v3 compatibility mode.

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts", "dist"]
}
```

**Step 4: Create `src/shared.ts` — reusable Zod schemas**

```typescript
import { z } from 'zod'

// Pagination
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export type PaginationQuery = z.infer<typeof paginationQuery>

// Paginated response wrapper
export function paginatedResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  })
}

// Common response shapes
export const messageResponse = z.object({ message: z.string() })
export const errorResponse = z.object({
  error: z.string(),
  message: z.string().optional(),
  issues: z.array(z.any()).optional(),
})

// UUID param
export const uuidParam = z.object({ id: z.string().uuid() })
```

**Step 5: Create `src/index.ts` — barrel export**

```typescript
export * from './shared'
// Contract modules will be added in subsequent tasks
```

**Step 6: Write test for shared schemas**

```typescript
// src/__tests__/shared.test.ts
import { describe, it, expect } from 'vitest'
import { paginationQuery, paginatedResponse, messageResponse } from '../shared'
import { z } from 'zod'

describe('shared schemas', () => {
  it('paginationQuery parses defaults', () => {
    const result = paginationQuery.parse({})
    expect(result).toEqual({ page: 1, limit: 25 })
  })

  it('paginationQuery coerces strings', () => {
    const result = paginationQuery.parse({ page: '3', limit: '10' })
    expect(result).toEqual({ page: 3, limit: 10 })
  })

  it('paginationQuery rejects invalid', () => {
    expect(() => paginationQuery.parse({ page: 0 })).toThrow()
    expect(() => paginationQuery.parse({ limit: 200 })).toThrow()
  })

  it('paginatedResponse wraps item schema', () => {
    const schema = paginatedResponse(z.object({ name: z.string() }))
    const result = schema.parse({ items: [{ name: 'test' }], total: 1, page: 1, limit: 25 })
    expect(result.items).toHaveLength(1)
  })
})
```

**Step 7: Run tests**

```bash
cd /Users/lsendel/Projects/indices_contract
bun install
bun run test:run
```

Expected: PASS

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold @indices/contract package with shared schemas"
```

---

## Task 2: Define Prospect + Campaign + Segment Contracts

**Files:**
- Create: `/Users/lsendel/Projects/indices_contract/src/prospects.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/campaigns.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/segments.ts`
- Modify: `/Users/lsendel/Projects/indices_contract/src/index.ts`
- Test: `/Users/lsendel/Projects/indices_contract/src/__tests__/contracts.test.ts`

**Step 1: Write `src/prospects.ts`**

Reference: backend `src/routes/prospects.ts` — 5 endpoints (GET list, GET :id, POST, PATCH :id, DELETE :id)

```typescript
import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { paginationQuery, paginatedResponse, messageResponse } from './shared'

const c = initContract()

export const prospectSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  company: z.string(),
  role: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  linkedinId: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

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

export const prospectsContract = c.router({
  list: {
    method: 'GET',
    path: '/api/v1/prospects',
    query: paginationQuery,
    responses: {
      200: paginatedResponse(prospectSchema),
    },
    summary: 'List prospects',
  },
  get: {
    method: 'GET',
    path: '/api/v1/prospects/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      200: prospectSchema,
      404: messageResponse,
    },
    summary: 'Get prospect by ID',
  },
  create: {
    method: 'POST',
    path: '/api/v1/prospects',
    body: prospectCreate,
    responses: {
      201: prospectSchema,
      422: z.object({ error: z.string(), issues: z.array(z.any()) }),
    },
    summary: 'Create prospect',
  },
  update: {
    method: 'PATCH',
    path: '/api/v1/prospects/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    body: prospectUpdate,
    responses: {
      200: prospectSchema,
      404: messageResponse,
    },
    summary: 'Update prospect',
  },
  delete: {
    method: 'DELETE',
    path: '/api/v1/prospects/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    body: z.any().optional(),
    responses: {
      200: messageResponse,
      404: messageResponse,
    },
    summary: 'Delete prospect',
  },
})

export type Prospect = z.infer<typeof prospectSchema>
export type ProspectCreate = z.infer<typeof prospectCreate>
export type ProspectUpdate = z.infer<typeof prospectUpdate>
```

**Step 2: Write `src/campaigns.ts`**

Reference: backend `src/routes/campaigns.ts` — 4 endpoints (GET list, GET :id, POST, PATCH :id/status)

```typescript
import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { paginationQuery, paginatedResponse, messageResponse } from './shared'

const c = initContract()

export const channelResultSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  channel: z.string(),
  status: z.string(),
  provider: z.string().nullable(),
  messageContent: z.string().nullable(),
  messageSubject: z.string().nullable(),
  errorMessage: z.string().nullable(),
  sentAt: z.string().nullable(),
})

export const campaignSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  goal: z.string(),
  productDescription: z.string().nullable(),
  status: z.enum(['pending', 'running', 'completed', 'partial', 'failed', 'cancelled']),
  channelsRequested: z.any(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const campaignWithResults = campaignSchema.extend({
  channelResults: z.array(channelResultSchema),
})

export const campaignCreate = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().min(1).max(200),
  productDescription: z.string().max(500).optional(),
  channels: z.array(z.enum(['email', 'sms', 'voice', 'linkedin', 'whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'vimeo', 'video'])).min(1),
  prospectId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const campaignsContract = c.router({
  list: {
    method: 'GET',
    path: '/api/v1/campaigns',
    query: paginationQuery,
    responses: {
      200: paginatedResponse(campaignSchema),
    },
    summary: 'List campaigns',
  },
  get: {
    method: 'GET',
    path: '/api/v1/campaigns/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: {
      200: campaignWithResults,
      404: messageResponse,
    },
    summary: 'Get campaign with channel results',
  },
  create: {
    method: 'POST',
    path: '/api/v1/campaigns',
    body: campaignCreate,
    responses: {
      201: campaignSchema,
    },
    summary: 'Create campaign',
  },
  updateStatus: {
    method: 'PATCH',
    path: '/api/v1/campaigns/:id/status',
    pathParams: z.object({ id: z.string().uuid() }),
    body: z.object({ status: z.string() }),
    responses: {
      200: campaignSchema,
      404: messageResponse,
    },
    summary: 'Update campaign status',
  },
})

export type Campaign = z.infer<typeof campaignSchema>
export type CampaignCreate = z.infer<typeof campaignCreate>
```

**Step 3: Write `src/segments.ts`**

Reference: backend `src/routes/segments.ts` — 5 endpoints

```typescript
import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { paginationQuery, paginatedResponse, messageResponse } from './shared'

const c = initContract()

export const segmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  rules: z.record(z.string(), z.any()),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const segmentCreate = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rules: z.record(z.string(), z.any()).default({}),
  active: z.boolean().default(true),
})

export const segmentsContract = c.router({
  list: {
    method: 'GET',
    path: '/api/v1/segments',
    query: paginationQuery,
    responses: { 200: paginatedResponse(segmentSchema) },
    summary: 'List segments',
  },
  get: {
    method: 'GET',
    path: '/api/v1/segments/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: { 200: segmentSchema, 404: messageResponse },
    summary: 'Get segment',
  },
  create: {
    method: 'POST',
    path: '/api/v1/segments',
    body: segmentCreate,
    responses: { 201: segmentSchema },
    summary: 'Create segment',
  },
  update: {
    method: 'PATCH',
    path: '/api/v1/segments/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    body: segmentCreate.partial(),
    responses: { 200: segmentSchema, 404: messageResponse },
    summary: 'Update segment',
  },
  delete: {
    method: 'DELETE',
    path: '/api/v1/segments/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    body: z.any().optional(),
    responses: { 200: messageResponse, 404: messageResponse },
    summary: 'Delete segment',
  },
})

export type Segment = z.infer<typeof segmentSchema>
```

**Step 4: Update `src/index.ts`**

```typescript
export * from './shared'
export * from './prospects'
export * from './campaigns'
export * from './segments'
```

**Step 5: Write contract structure tests**

```typescript
// src/__tests__/contracts.test.ts
import { describe, it, expect } from 'vitest'
import { prospectsContract } from '../prospects'
import { campaignsContract } from '../campaigns'
import { segmentsContract } from '../segments'

describe('prospectsContract', () => {
  it('has correct paths and methods', () => {
    expect(prospectsContract.list.method).toBe('GET')
    expect(prospectsContract.list.path).toBe('/api/v1/prospects')
    expect(prospectsContract.create.method).toBe('POST')
    expect(prospectsContract.get.path).toBe('/api/v1/prospects/:id')
    expect(prospectsContract.update.method).toBe('PATCH')
    expect(prospectsContract.delete.method).toBe('DELETE')
  })
})

describe('campaignsContract', () => {
  it('has correct paths and methods', () => {
    expect(campaignsContract.list.method).toBe('GET')
    expect(campaignsContract.create.method).toBe('POST')
    expect(campaignsContract.updateStatus.path).toBe('/api/v1/campaigns/:id/status')
  })
})

describe('segmentsContract', () => {
  it('has correct paths and methods', () => {
    expect(segmentsContract.list.method).toBe('GET')
    expect(segmentsContract.create.method).toBe('POST')
    expect(segmentsContract.update.method).toBe('PATCH')
    expect(segmentsContract.delete.method).toBe('DELETE')
  })
})
```

**Step 6: Run tests**

```bash
cd /Users/lsendel/Projects/indices_contract
bun run test:run
```

Expected: PASS

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add prospect, campaign, and segment ts-rest contracts"
```

---

## Task 3: Define Signal + Experiment + Workflow + Evolution Contracts

**Files:**
- Create: `/Users/lsendel/Projects/indices_contract/src/signals.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/experiments.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/workflows.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/evolution.ts`
- Modify: `/Users/lsendel/Projects/indices_contract/src/index.ts`
- Test: `/Users/lsendel/Projects/indices_contract/src/__tests__/contracts-2.test.ts`

**Step 1: Write `src/signals.ts`**

Reference: backend `src/routes/signals.ts` — 3 endpoints (POST capture, GET hot, GET accounts/:accountId)

```typescript
import { initContract } from '@ts-rest/core'
import { z } from 'zod'

const c = initContract()

export const signalSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  accountId: z.string(),
  signalType: z.enum(['page_view', 'email_open', 'email_click', 'form_submit', 'demo_request', 'pricing_view', 'content_download', 'social_mention', 'competitor_visit', 'custom']),
  signalSource: z.string(),
  strength: z.number(),
  signalData: z.record(z.string(), z.any()),
  createdAt: z.string(),
})

export const signalCapture = z.object({
  accountId: z.string().min(1),
  signalType: z.enum(['page_view', 'email_open', 'email_click', 'form_submit', 'demo_request', 'pricing_view', 'content_download', 'social_mention', 'competitor_visit', 'custom']),
  signalSource: z.string().min(1),
  strength: z.number().int().min(1).max(100),
  signalData: z.record(z.string(), z.any()).default({}),
})

export const accountScoreSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string(),
  totalScore: z.number(),
  behavioralScore: z.number(),
  demographicScore: z.number(),
  firmographicScore: z.number(),
  level: z.enum(['hot', 'warm', 'cold', 'unqualified']),
})

export const signalsContract = c.router({
  capture: {
    method: 'POST',
    path: '/api/v1/signals/capture',
    body: signalCapture,
    responses: { 201: signalSchema },
    summary: 'Capture a buying signal',
  },
  hotAccounts: {
    method: 'GET',
    path: '/api/v1/signals/hot',
    query: z.object({
      threshold: z.coerce.number().optional(),
      limit: z.coerce.number().optional(),
    }),
    responses: { 200: z.array(accountScoreSchema) },
    summary: 'Get hot accounts by score',
  },
  accountSignals: {
    method: 'GET',
    path: '/api/v1/signals/accounts/:accountId',
    pathParams: z.object({ accountId: z.string() }),
    query: z.object({ days: z.coerce.number().optional() }),
    responses: { 200: z.array(signalSchema) },
    summary: 'Get signals for account',
  },
})
```

**Step 2: Write `src/experiments.ts`**

Reference: backend `src/routes/experiments.ts` — 6 endpoints

```typescript
import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { messageResponse } from './shared'

const c = initContract()

export const experimentArmSchema = z.object({
  id: z.string().uuid(),
  experimentId: z.string().uuid(),
  variantName: z.string(),
  content: z.record(z.string(), z.any()),
  alpha: z.number(),
  beta: z.number(),
  trafficPct: z.number(),
  impressions: z.number(),
  conversions: z.number(),
})

export const experimentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  type: z.enum(['ab_test', 'mab_thompson', 'mab_ucb', 'mab_epsilon']),
  status: z.enum(['draft', 'running', 'paused', 'completed']),
  targetMetric: z.string(),
  winnerId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const experimentWithArms = experimentSchema.extend({
  arms: z.array(experimentArmSchema),
})

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

export const allocationResult = z.object({
  selectedArm: experimentArmSchema,
  allArms: z.array(experimentArmSchema.extend({ trafficPct: z.number() })),
})

export const experimentsContract = c.router({
  list: {
    method: 'GET',
    path: '/api/v1/experiments',
    responses: { 200: z.array(experimentSchema) },
    summary: 'List experiments',
  },
  get: {
    method: 'GET',
    path: '/api/v1/experiments/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: { 200: experimentWithArms, 404: messageResponse },
    summary: 'Get experiment with arms',
  },
  create: {
    method: 'POST',
    path: '/api/v1/experiments',
    body: experimentCreate,
    responses: { 201: experimentSchema },
    summary: 'Create experiment',
  },
  addArm: {
    method: 'POST',
    path: '/api/v1/experiments/:id/arms',
    pathParams: z.object({ id: z.string().uuid() }),
    body: armCreate,
    responses: { 201: experimentArmSchema },
    summary: 'Add arm to experiment',
  },
  allocate: {
    method: 'GET',
    path: '/api/v1/experiments/:id/allocate',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: { 200: allocationResult },
    summary: 'MAB Thompson allocation',
  },
  reward: {
    method: 'POST',
    path: '/api/v1/experiments/:id/reward',
    pathParams: z.object({ id: z.string().uuid() }),
    body: armReward,
    responses: { 200: experimentArmSchema },
    summary: 'Record arm reward',
  },
})
```

**Step 3: Write `src/workflows.ts`**

Reference: backend `src/routes/workflows.ts` — 3 endpoints

```typescript
import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { paginationQuery, paginatedResponse, messageResponse } from './shared'

const c = initContract()

export const workflowNodeSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'awaiting_approval']),
  agentConfigId: z.string().uuid().nullable(),
  inputs: z.any(),
  outputs: z.any(),
  executionOrder: z.number(),
})

export const workflowEdgeSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  priority: z.number(),
})

export const workflowSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  goal: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'paused']),
  campaignId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const workflowWithGraph = workflowSchema.extend({
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
})

export const workflowCreate = z.object({
  goal: z.string().min(1).max(500),
  campaignId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})

export const workflowsContract = c.router({
  list: {
    method: 'GET',
    path: '/api/v1/workflows',
    query: paginationQuery,
    responses: { 200: paginatedResponse(workflowSchema) },
    summary: 'List workflows',
  },
  get: {
    method: 'GET',
    path: '/api/v1/workflows/:id',
    pathParams: z.object({ id: z.string().uuid() }),
    responses: { 200: workflowWithGraph, 404: messageResponse },
    summary: 'Get workflow with nodes and edges',
  },
  create: {
    method: 'POST',
    path: '/api/v1/workflows',
    body: workflowCreate,
    responses: { 201: workflowWithGraph },
    summary: 'Create workflow (AI-generated DAG)',
  },
})
```

**Step 4: Write `src/evolution.ts`**

Reference: backend `src/routes/evolution.ts` — 4 endpoints

```typescript
import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { paginationQuery, paginatedResponse, messageResponse } from './shared'

const c = initContract()

export const evolutionCycleSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  agentConfigId: z.string().uuid(),
  generation: z.number(),
  strategy: z.enum(['textgrad', 'ga', 'de', 'hybrid']),
  populationSize: z.number(),
  generations: z.number(),
  status: z.string(),
  bestScore: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const hitlRequestSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  workflowId: z.string().uuid().nullable(),
  nodeId: z.string().uuid().nullable(),
  decision: z.enum(['pending', 'approved', 'rejected', 'modified']),
  context: z.any(),
  modifications: z.any().nullable(),
  decidedBy: z.string().nullable(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
})

export const evolutionStart = z.object({
  agentConfigId: z.string().uuid(),
  strategy: z.enum(['textgrad', 'ga', 'de', 'hybrid']).default('hybrid'),
  populationSize: z.number().int().min(2).max(20).default(5),
  generations: z.number().int().min(1).max(50).default(10),
})

export const hitlDecision = z.object({
  decision: z.enum(['approved', 'rejected', 'modified']),
  modifications: z.record(z.string(), z.any()).optional(),
})

export const evolutionContract = c.router({
  listCycles: {
    method: 'GET',
    path: '/api/v1/evolution/cycles',
    query: paginationQuery,
    responses: { 200: paginatedResponse(evolutionCycleSchema) },
    summary: 'List evolution cycles',
  },
  startCycle: {
    method: 'POST',
    path: '/api/v1/evolution/cycles',
    body: evolutionStart,
    responses: { 201: evolutionCycleSchema },
    summary: 'Start evolution cycle',
  },
  listHitl: {
    method: 'GET',
    path: '/api/v1/evolution/hitl',
    query: paginationQuery,
    responses: { 200: paginatedResponse(hitlRequestSchema) },
    summary: 'List pending HITL requests',
  },
  decideHitl: {
    method: 'POST',
    path: '/api/v1/evolution/hitl/:id/decide',
    pathParams: z.object({ id: z.string().uuid() }),
    body: hitlDecision,
    responses: { 200: hitlRequestSchema, 404: messageResponse },
    summary: 'Approve/reject/modify HITL request',
  },
})
```

**Step 5: Update `src/index.ts`**

```typescript
export * from './shared'
export * from './prospects'
export * from './campaigns'
export * from './segments'
export * from './signals'
export * from './experiments'
export * from './workflows'
export * from './evolution'
```

**Step 6: Write tests**

```typescript
// src/__tests__/contracts-2.test.ts
import { describe, it, expect } from 'vitest'
import { signalsContract } from '../signals'
import { experimentsContract } from '../experiments'
import { workflowsContract } from '../workflows'
import { evolutionContract } from '../evolution'

describe('signalsContract', () => {
  it('has capture, hotAccounts, accountSignals', () => {
    expect(signalsContract.capture.method).toBe('POST')
    expect(signalsContract.hotAccounts.method).toBe('GET')
    expect(signalsContract.accountSignals.path).toBe('/api/v1/signals/accounts/:accountId')
  })
})

describe('experimentsContract', () => {
  it('has 6 endpoints', () => {
    expect(Object.keys(experimentsContract)).toHaveLength(6)
    expect(experimentsContract.allocate.method).toBe('GET')
    expect(experimentsContract.reward.method).toBe('POST')
  })
})

describe('workflowsContract', () => {
  it('has list, get, create', () => {
    expect(Object.keys(workflowsContract)).toHaveLength(3)
  })
})

describe('evolutionContract', () => {
  it('has cycles and HITL', () => {
    expect(evolutionContract.listCycles.method).toBe('GET')
    expect(evolutionContract.decideHitl.path).toBe('/api/v1/evolution/hitl/:id/decide')
  })
})
```

**Step 7: Run tests, commit**

```bash
bun run test:run
git add -A
git commit -m "feat: add signal, experiment, workflow, evolution contracts"
```

---

## Task 4: Define Remaining Domain Contracts

**Files:**
- Create: `/Users/lsendel/Projects/indices_contract/src/sentiment.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/accounts.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/brand-kits.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/feeds.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/scraper.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/zeluto.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/analytics.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/mcp.ts`
- Create: `/Users/lsendel/Projects/indices_contract/src/personas.ts`
- Modify: `/Users/lsendel/Projects/indices_contract/src/index.ts`
- Test: `/Users/lsendel/Projects/indices_contract/src/__tests__/contracts-3.test.ts`

This task creates contracts for all remaining backend domains. Follow the same pattern as Tasks 2-3:
- Read the corresponding backend route file for exact endpoints
- Define response schemas matching DB table columns
- Define request body schemas matching `src/types/api.ts`
- Export from `src/index.ts`

**Contracts to define:**

| File | Backend Route | Endpoints |
|------|--------------|-----------|
| `sentiment.ts` | `src/routes/social-sentiment.ts` | GET signals, GET drift, GET competitive |
| `accounts.ts` | `src/routes/abm.ts` | GET list, POST, GET :id, POST deals |
| `brand-kits.ts` | `src/routes/brand-audit.ts` | GET list, POST, GET :id, POST :id/audit |
| `feeds.ts` | `src/routes/feeds.ts` | GET list, POST, PATCH :id, DELETE :id |
| `scraper.ts` | `src/routes/scraper.ts` | GET jobs, POST jobs, GET jobs/:id, POST jobs/:id/cancel |
| `zeluto.ts` | `src/routes/zeluto.ts` | POST config, GET config, POST sync/content, POST sync/contacts, POST sync/campaign, POST sync/experiment, GET sync/logs |
| `analytics.ts` | `src/routes/analytics.ts` | GET dashboard |
| `mcp.ts` | `src/routes/mcp.ts` | GET tools, POST call |
| `personas.ts` | `src/routes/personas.ts` | GET list, POST, GET :id |

For each: define contract using `initContract()`, export schemas and types.

**Step 1: Write all 9 contract files** following the pattern from Tasks 2-3.

**Step 2: Update `src/index.ts` to re-export all**

**Step 3: Create root contract**

```typescript
// Add to src/index.ts
import { initContract } from '@ts-rest/core'

const c = initContract()

export const contract = c.router({
  prospects: prospectsContract,
  campaigns: campaignsContract,
  segments: segmentsContract,
  signals: signalsContract,
  experiments: experimentsContract,
  workflows: workflowsContract,
  evolution: evolutionContract,
  sentiment: sentimentContract,
  accounts: accountsContract,
  brandKits: brandKitsContract,
  feeds: feedsContract,
  scraper: scraperContract,
  zeluto: zelutoContract,
  analytics: analyticsContract,
  mcp: mcpContract,
  personas: personasContract,
})
```

**Step 4: Write structural tests, run, commit**

```bash
bun run test:run
git add -A
git commit -m "feat: add all remaining domain contracts + root contract"
```

**Step 5: Build and link**

```bash
cd /Users/lsendel/Projects/indices_contract
bun run build
bun link
```

---

## Task 5: Scaffold `indices_frontend` Project

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/package.json`
- Create: `/Users/lsendel/Projects/indices_frontend/tsconfig.json`
- Create: `/Users/lsendel/Projects/indices_frontend/wrangler.toml`
- Create: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`

**Step 1: Create directory structure**

```bash
mkdir -p /Users/lsendel/Projects/indices_frontend/src/{shared/{middleware,layouts,components},domains,events,static/{js,css}}
cd /Users/lsendel/Projects/indices_frontend
git init
```

**Step 2: Create `package.json`**

```json
{
  "name": "indices-frontend",
  "version": "0.1.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "css:build": "npx tailwindcss -i src/static/css/input.css -o src/static/css/app.css --minify",
    "css:watch": "npx tailwindcss -i src/static/css/input.css -o src/static/css/app.css --watch"
  },
  "dependencies": {
    "@indices/contract": "link:../indices_contract",
    "@ts-rest/core": "^3.51.0",
    "hono": "^4.12.1"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250214.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.7.0",
    "vitest": "^4.0.18",
    "wrangler": "^3.99.0"
  }
}
```

**Step 3: Create `wrangler.toml`**

```toml
name = "indices-frontend"
main = "src/index.tsx"
compatibility_date = "2026-02-22"

[vars]
API_BASE_URL = "https://pi.indices.app"

# Local dev: proxy to local backend
[env.dev.vars]
API_BASE_URL = "http://localhost:3001"
```

**Step 4: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

**Step 5: Create `src/index.tsx` — app entry**

```tsx
import { Hono } from 'hono'

type Env = {
  Bindings: { API_BASE_URL: string }
  Variables: { apiBaseUrl: string; cookies: string }
}

const app = new Hono<Env>()

// Inject API base URL from env
app.use('*', async (c, next) => {
  c.set('apiBaseUrl', c.env.API_BASE_URL)
  c.set('cookies', c.req.header('cookie') || '')
  await next()
})

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Domain routes will be registered here in subsequent tasks

export default app
```

**Step 6: Install deps, verify dev server starts**

```bash
cd /Users/lsendel/Projects/indices_frontend
bun install
# Quick check that wrangler can parse the config
npx wrangler dev --dry-run 2>&1 | head -5
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold indices_frontend project with wrangler + Hono"
```

---

## Task 6: Shared Kernel — API Client + Auth Middleware

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/api-client.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/middleware/auth.ts`
- Test: `/Users/lsendel/Projects/indices_frontend/src/__tests__/api-client.test.ts`

**Step 1: Write `src/shared/api-client.ts`**

The API client is a thin wrapper around `fetch` that forwards the browser's cookies to `pi.indices.app`. It uses the ts-rest contract for type safety.

```typescript
import { initClient } from '@ts-rest/core'
import { contract } from '@indices/contract'

export function createApiClient(baseUrl: string, cookies: string) {
  return initClient(contract, {
    baseUrl,
    baseHeaders: {
      cookie: cookies,
      'content-type': 'application/json',
    },
  })
}

export type ApiClient = ReturnType<typeof createApiClient>
```

**Step 2: Write `src/shared/middleware/auth.ts`**

```typescript
import type { MiddlewareHandler } from 'hono'

type Env = {
  Bindings: { API_BASE_URL: string }
  Variables: { apiBaseUrl: string; cookies: string }
}

/**
 * Check for session cookie. If missing, redirect to /login.
 * If present, forward it — the backend validates it.
 */
export function authMiddleware(): MiddlewareHandler<Env> {
  return async (c, next) => {
    const cookies = c.req.header('cookie') || ''
    const hasSession = cookies.includes('better-auth.session_token=')

    // Allow public routes
    const path = new URL(c.req.url).pathname
    if (path === '/login' || path === '/health' || path.startsWith('/static/')) {
      return next()
    }

    if (!hasSession) {
      return c.redirect('/login')
    }

    return next()
  }
}
```

**Step 3: Write test for API client creation**

```typescript
// src/__tests__/api-client.test.ts
import { describe, it, expect } from 'vitest'
import { createApiClient } from '../shared/api-client'

describe('createApiClient', () => {
  it('creates client with base URL', () => {
    const client = createApiClient('http://localhost:3001', 'session=abc')
    expect(client).toBeDefined()
    expect(client.prospects).toBeDefined()
    expect(client.campaigns).toBeDefined()
  })
})
```

**Step 4: Run tests, commit**

```bash
bun run test:run
git add -A
git commit -m "feat: add API client and auth middleware"
```

---

## Task 7: Shared Kernel — Layouts + Tailwind

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/layouts/shell.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/layouts/auth.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/middleware/layout.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/src/static/css/input.css`
- Create: `/Users/lsendel/Projects/indices_frontend/tailwind.config.js`

**Step 1: Create `tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

**Step 2: Create `src/static/css/input.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 3: Write `src/shared/layouts/shell.tsx`**

The app shell with sidebar nav, header, and main content area. Includes HTMX + SSE script tags.

```tsx
import type { FC } from 'hono/jsx'

const navItems = [
  { href: '/', label: 'Dashboard', icon: 'chart-bar' },
  { href: '/prospects', label: 'Prospects', icon: 'users' },
  { href: '/campaigns', label: 'Campaigns', icon: 'megaphone' },
  { href: '/experiments', label: 'Experiments', icon: 'beaker' },
  { href: '/workflows', label: 'Workflows', icon: 'share' },
  { href: '/evolution', label: 'Evolution', icon: 'sparkles' },
  { href: '/sentiment', label: 'Sentiment', icon: 'chart-pie' },
  { href: '/accounts', label: 'Accounts', icon: 'building' },
  { href: '/settings', label: 'Settings', icon: 'cog' },
]

export const Shell: FC<{ title: string; activePath: string; children: any }> = ({
  title,
  activePath,
  children,
}) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — Indices</title>
      <link rel="stylesheet" href="/static/css/app.css" />
      <script src="https://unpkg.com/htmx.org@2.0.4" crossorigin="anonymous"></script>
      <script src="https://unpkg.com/htmx-ext-sse@2.2.2" crossorigin="anonymous"></script>
    </head>
    <body class="bg-gray-50 text-gray-900">
      <div class="flex h-screen">
        {/* Sidebar */}
        <nav class="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div class="p-4 border-b border-gray-200">
            <h1 class="text-xl font-bold text-indigo-600">Indices</h1>
          </div>
          <ul class="flex-1 py-4 space-y-1">
            {navItems.map((item) => (
              <li>
                <a
                  href={item.href}
                  class={`block px-4 py-2 text-sm rounded-md mx-2 ${
                    activePath === item.href
                      ? 'bg-indigo-50 text-indigo-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                  hx-get={item.href}
                  hx-target="#main-content"
                  hx-push-url="true"
                  hx-swap="innerHTML"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
          <div class="p-4 border-t border-gray-200">
            <div id="hitl-badge" hx-get="/evolution/hitl-count" hx-trigger="load, refresh" hx-swap="innerHTML">
            </div>
          </div>
        </nav>

        {/* Main */}
        <main class="flex-1 overflow-y-auto">
          <header class="bg-white border-b border-gray-200 px-6 py-4">
            <h2 class="text-lg font-semibold">{title}</h2>
          </header>
          <div id="main-content" class="p-6">
            {children}
          </div>
        </main>
      </div>

      {/* Toast container */}
      <div id="toast-container" class="fixed bottom-4 right-4 space-y-2 z-50"></div>

      {/* Modal container */}
      <div id="modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-40"></div>

      {/* SSE connection */}
      <script src="/static/js/sse.js"></script>
    </body>
  </html>
)
```

**Step 4: Write `src/shared/layouts/auth.tsx`**

```tsx
import type { FC } from 'hono/jsx'

export const AuthLayout: FC<{ title: string; children: any }> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — Indices</title>
      <link rel="stylesheet" href="/static/css/app.css" />
      <script src="https://unpkg.com/htmx.org@2.0.4" crossorigin="anonymous"></script>
    </head>
    <body class="bg-gray-50 min-h-screen flex items-center justify-center">
      <div class="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 class="text-2xl font-bold text-center text-indigo-600 mb-6">Indices</h1>
        {children}
      </div>
    </body>
  </html>
)
```

**Step 5: Write layout middleware**

```typescript
// src/shared/middleware/layout.ts
import type { MiddlewareHandler } from 'hono'

/**
 * Detects if request is an HTMX partial request.
 * Full page loads get the shell layout wrapper.
 * HTMX requests get just the fragment.
 */
export function isHtmxRequest(c: any): boolean {
  return c.req.header('hx-request') === 'true'
}
```

**Step 6: Build CSS, commit**

```bash
bun run css:build
git add -A
git commit -m "feat: add shell layout, auth layout, Tailwind setup"
```

---

## Task 8: Shared Components

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/components/table.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/components/form.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/components/modal.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/components/pagination.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/components/toast.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/components/stat-card.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/shared/components/index.ts`
- Test: `/Users/lsendel/Projects/indices_frontend/src/__tests__/components.test.ts`

**Step 1: Write `table.tsx`**

A reusable data table component with HTMX-friendly sorting and row actions.

```tsx
import type { FC } from 'hono/jsx'

interface Column<T> {
  key: string
  label: string
  render?: (item: T) => any
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowHref?: (item: T) => string
  emptyMessage?: string
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowHref,
  emptyMessage = 'No data found',
}: TableProps<T>) {
  if (data.length === 0) {
    return <div class="text-center py-8 text-gray-500">{emptyMessage}</div>
  }

  return (
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          {columns.map((col) => (
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        {data.map((item) => (
          <tr
            class={rowHref ? 'hover:bg-gray-50 cursor-pointer' : ''}
            {...(rowHref
              ? {
                  'hx-get': rowHref(item),
                  'hx-target': '#main-content',
                  'hx-push-url': 'true',
                }
              : {})}
          >
            {columns.map((col) => (
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {col.render ? col.render(item) : item[col.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

**Step 2: Write `pagination.tsx`**

```tsx
import type { FC } from 'hono/jsx'

interface PaginationProps {
  page: number
  limit: number
  total: number
  baseUrl: string
}

export const Pagination: FC<PaginationProps> = ({ page, limit, total, baseUrl }) => {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const separator = baseUrl.includes('?') ? '&' : '?'

  return (
    <nav class="flex items-center justify-between py-4">
      <span class="text-sm text-gray-500">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </span>
      <div class="flex gap-2">
        {page > 1 && (
          <a
            class="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            hx-get={`${baseUrl}${separator}page=${page - 1}&limit=${limit}`}
            hx-target="#main-content"
            hx-push-url="true"
          >
            Previous
          </a>
        )}
        {page < totalPages && (
          <a
            class="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            hx-get={`${baseUrl}${separator}page=${page + 1}&limit=${limit}`}
            hx-target="#main-content"
            hx-push-url="true"
          >
            Next
          </a>
        )}
      </div>
    </nav>
  )
}
```

**Step 3: Write `stat-card.tsx`**

```tsx
import type { FC } from 'hono/jsx'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  positive?: boolean
}

export const StatCard: FC<StatCardProps> = ({ label, value, change, positive }) => (
  <div class="bg-white rounded-lg shadow p-6">
    <dt class="text-sm font-medium text-gray-500 truncate">{label}</dt>
    <dd class="mt-1 text-3xl font-semibold text-gray-900">{value}</dd>
    {change && (
      <dd class={`mt-1 text-sm ${positive ? 'text-green-600' : 'text-red-600'}`}>
        {positive ? '+' : ''}{change}
      </dd>
    )}
  </div>
)
```

**Step 4: Write `modal.tsx`**

```tsx
import type { FC } from 'hono/jsx'

export const Modal: FC<{ title: string; children: any }> = ({ title, children }) => (
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
       onclick="if(event.target===this) htmx.trigger('#modal','close')">
    <div class="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4">
      <div class="flex items-center justify-between p-4 border-b">
        <h3 class="text-lg font-semibold">{title}</h3>
        <button class="text-gray-400 hover:text-gray-600"
                hx-get="/close-modal" hx-target="#modal" hx-swap="innerHTML">
          &times;
        </button>
      </div>
      <div class="p-4">{children}</div>
    </div>
  </div>
)
```

**Step 5: Write `form.tsx` and `toast.tsx`**

`form.tsx` — reusable form field components (TextInput, Select, Textarea, SubmitButton)
`toast.tsx` — toast notification partial (success/error/info variants)

**Step 6: Create `index.ts` barrel export**

```typescript
export { DataTable } from './table'
export { Pagination } from './pagination'
export { StatCard } from './stat-card'
export { Modal } from './modal'
```

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add shared UI components (table, pagination, modal, stat-card, form, toast)"
```

---

## Task 9: SSE Proxy + Event Handlers + Static JS

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/events/sse-proxy.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/src/events/handlers.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/src/static/js/sse.js`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`

**Step 1: Write `src/events/sse-proxy.ts`**

The CF Worker proxies SSE from the backend to the browser, forwarding the session cookie.

```typescript
import { Hono } from 'hono'

type Env = {
  Bindings: { API_BASE_URL: string }
  Variables: { apiBaseUrl: string; cookies: string }
}

export function createSseProxyRoutes() {
  const router = new Hono<Env>()

  router.get('/proxy', async (c) => {
    const apiUrl = c.get('apiBaseUrl')
    const cookies = c.get('cookies')

    const response = await fetch(`${apiUrl}/api/v1/sse/stream`, {
      headers: { cookie: cookies },
    })

    if (!response.ok || !response.body) {
      return c.text('SSE connection failed', 502)
    }

    // Proxy the stream
    return new Response(response.body, {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
      },
    })
  })

  return router
}
```

**Step 2: Write `src/events/handlers.ts`**

```typescript
// Maps SSE event types to HTMX target selectors for auto-refresh
export const sseEventMap: Record<string, { target: string; toast?: string }> = {
  'campaign:created': { target: '#campaign-list', toast: 'Campaign created' },
  'campaign:status_changed': { target: '#campaign-list' },
  'prospect:imported': { target: '#prospect-list', toast: 'Prospect imported' },
  'prospect:enriched': { target: '#prospect-list' },
  'signal:captured': { target: '#signal-list' },
  'signal:account_scored': { target: '#hot-accounts' },
  'sentiment:drift_detected': { target: '#sentiment-chart', toast: 'Sentiment drift detected' },
  'experiment:results': { target: '#experiment-detail' },
  'workflow:generated': { target: '#workflow-list', toast: 'Workflow generated' },
  'workflow:stage_changed': { target: '#workflow-detail' },
  'evolution:cycle_started': { target: '#evolution-list', toast: 'Evolution cycle started' },
  'evolution:cycle_completed': { target: '#evolution-list', toast: 'Evolution cycle completed' },
  'hitl:request_created': { target: '#hitl-badge', toast: 'New approval request' },
  'hitl:decision_made': { target: '#hitl-list' },
  'scrape:job_started': { target: '#scrape-list' },
  'scrape:job_completed': { target: '#scrape-list', toast: 'Scrape job completed' },
  'scrape:job_failed': { target: '#scrape-list', toast: 'Scrape job failed' },
  'sync:started': { target: '#sync-list' },
  'sync:completed': { target: '#sync-list', toast: 'Sync completed' },
  'sync:failed': { target: '#sync-list', toast: 'Sync failed' },
}
```

**Step 3: Write `src/static/js/sse.js`**

```javascript
(function() {
  const es = new EventSource('/sse/proxy');

  // Event → HTMX trigger mapping
  const events = {
    'campaign:created': '#campaign-list',
    'campaign:status_changed': '#campaign-list',
    'prospect:imported': '#prospect-list',
    'prospect:enriched': '#prospect-list',
    'signal:captured': '#signal-list',
    'signal:account_scored': '#hot-accounts',
    'sentiment:drift_detected': '#sentiment-chart',
    'experiment:results': '#experiment-detail',
    'workflow:generated': '#workflow-list',
    'workflow:stage_changed': '#workflow-detail',
    'evolution:cycle_started': '#evolution-list',
    'evolution:cycle_completed': '#evolution-list',
    'hitl:request_created': '#hitl-badge',
    'hitl:decision_made': '#hitl-list',
    'scrape:job_completed': '#scrape-list',
    'sync:completed': '#sync-list',
  };

  Object.entries(events).forEach(([event, selector]) => {
    es.addEventListener(event, () => {
      const el = document.querySelector(selector);
      if (el) htmx.trigger(el, 'refresh');
    });
  });

  // Toast notifications for important events
  const toastEvents = [
    'hitl:request_created', 'sentiment:drift_detected',
    'scrape:job_completed', 'scrape:job_failed',
    'evolution:cycle_completed', 'sync:failed',
  ];

  toastEvents.forEach((event) => {
    es.addEventListener(event, (e) => {
      showToast(event.replace(':', ' ').replace('_', ' '));
    });
  });

  // Reconnect on error
  es.onerror = () => {
    console.warn('SSE connection lost, reconnecting...');
  };

  // Toast helper
  function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'bg-white shadow-lg rounded-lg p-4 border-l-4 border-indigo-500 animate-slide-in';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  window.showToast = showToast;
})();
```

**Step 4: Register SSE route and static file serving in `src/index.tsx`**

```tsx
// Add to src/index.tsx
import { serveStatic } from 'hono/cloudflare-workers'
import { createSseProxyRoutes } from './events/sse-proxy'

app.route('/sse', createSseProxyRoutes())
app.get('/static/*', serveStatic({ root: './' }))
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add SSE proxy, event handlers, and static JS"
```

---

## Task 10: Analytics Domain (Dashboard)

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/analytics/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/analytics/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/analytics/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/analytics/service.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/analytics/charts.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/src/static/js/charts.js`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`
- Test: `/Users/lsendel/Projects/indices_frontend/src/__tests__/analytics-service.test.ts`

**Step 1: Write `service.ts`**

```typescript
import type { ApiClient } from '../../shared/api-client'

export interface DashboardData {
  prospects: number
  campaigns: number
  experiments: number
  workflows: number
  scrapeJobs: number
  feeds: number
}

export async function getDashboardData(client: ApiClient): Promise<DashboardData> {
  const result = await client.analytics.dashboard()
  if (result.status !== 200) throw new Error('Failed to load dashboard')
  return result.body as DashboardData
}
```

**Step 2: Write `pages.tsx`**

Full page with stat cards and chart placeholders.

```tsx
import type { FC } from 'hono/jsx'
import { Shell } from '../../shared/layouts/shell'
import { StatCard } from '../../shared/components'
import type { DashboardData } from './service'

export const DashboardPage: FC<{ data: DashboardData }> = ({ data }) => (
  <Shell title="Dashboard" activePath="/">
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      <StatCard label="Prospects" value={data.prospects} />
      <StatCard label="Campaigns" value={data.campaigns} />
      <StatCard label="Experiments" value={data.experiments} />
      <StatCard label="Workflows" value={data.workflows} />
      <StatCard label="Scrape Jobs" value={data.scrapeJobs} />
      <StatCard label="Feeds" value={data.feeds} />
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-sm font-medium text-gray-500 mb-4">Campaign Performance</h3>
        <canvas id="campaign-chart" class="w-full h-64"></canvas>
      </div>
      <div class="bg-white rounded-lg shadow p-6" id="sentiment-chart"
           hx-get="/sentiment/chart-partial" hx-trigger="load, refresh" hx-swap="innerHTML">
        <h3 class="text-sm font-medium text-gray-500 mb-4">Sentiment Trends</h3>
        <canvas id="sentiment-trend-chart" class="w-full h-64"></canvas>
      </div>
    </div>
    <script src="/static/js/charts.js"></script>
  </Shell>
)
```

**Step 3: Write `routes.tsx`**

```tsx
import { Hono } from 'hono'
import { createApiClient } from '../../shared/api-client'
import { isHtmxRequest } from '../../shared/middleware/layout'
import { getDashboardData } from './service'
import { DashboardPage } from './pages'
import { DashboardPartial } from './partials'

type Env = {
  Bindings: { API_BASE_URL: string }
  Variables: { apiBaseUrl: string; cookies: string }
}

export function createAnalyticsRoutes() {
  const router = new Hono<Env>()

  router.get('/', async (c) => {
    const client = createApiClient(c.get('apiBaseUrl'), c.get('cookies'))
    const data = await getDashboardData(client)

    if (isHtmxRequest(c)) {
      return c.html(<DashboardPartial data={data} />)
    }
    return c.html(<DashboardPage data={data} />)
  })

  return router
}
```

**Step 4: Write `partials.tsx`** — fragment version without shell wrapper

**Step 5: Write `charts.ts`** — Chart.js config builders

**Step 6: Write test for service, run, commit**

```bash
bun run test:run
git add -A
git commit -m "feat: add analytics dashboard domain"
```

---

## Task 11: Prospects Domain

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/prospects/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/prospects/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/prospects/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/prospects/service.ts`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`
- Test: `/Users/lsendel/Projects/indices_frontend/src/__tests__/prospects-service.test.ts`

**Step 1: Write `service.ts`**

```typescript
import type { ApiClient } from '../../shared/api-client'
import type { Prospect, ProspectCreate, ProspectUpdate } from '@indices/contract'

export async function listProspects(client: ApiClient, page = 1, limit = 25) {
  const result = await client.prospects.list({ query: { page, limit } })
  if (result.status !== 200) throw new Error('Failed to load prospects')
  return result.body
}

export async function getProspect(client: ApiClient, id: string) {
  const result = await client.prospects.get({ params: { id } })
  if (result.status === 404) return null
  if (result.status !== 200) throw new Error('Failed to load prospect')
  return result.body
}

export async function createProspect(client: ApiClient, data: ProspectCreate) {
  const result = await client.prospects.create({ body: data })
  if (result.status !== 201) throw new Error('Failed to create prospect')
  return result.body
}

export async function updateProspect(client: ApiClient, id: string, data: ProspectUpdate) {
  const result = await client.prospects.update({ params: { id }, body: data })
  if (result.status !== 200) throw new Error('Failed to update prospect')
  return result.body
}

export async function deleteProspect(client: ApiClient, id: string) {
  return client.prospects.delete({ params: { id }, body: {} })
}
```

**Step 2: Write `pages.tsx`**

Full pages: `ProspectListPage` (table with pagination, "Add Prospect" button) and `ProspectDetailPage` (detail view with edit/delete actions).

**Step 3: Write `partials.tsx`**

Fragments: `ProspectTable` (just the table + pagination), `ProspectForm` (create/edit form in modal), `ProspectDetail` (detail fragment).

**Step 4: Write `routes.tsx`**

```tsx
export function createProspectRoutes() {
  const router = new Hono<Env>()

  // List
  router.get('/', async (c) => { /* fetch + render list page or partial */ })

  // Detail
  router.get('/:id', async (c) => { /* fetch + render detail page or partial */ })

  // Create form (partial)
  router.get('/new', (c) => { /* render create form in modal */ })

  // Create (POST)
  router.post('/', async (c) => { /* parse form, call API, return updated list */ })

  // Edit form (partial)
  router.get('/:id/edit', async (c) => { /* render edit form in modal */ })

  // Update (PATCH)
  router.patch('/:id', async (c) => { /* parse form, call API, return detail */ })

  // Delete (DELETE)
  router.delete('/:id', async (c) => { /* call API, return updated list */ })

  return router
}
```

**Step 5: Register in `src/index.tsx`**

```tsx
import { createProspectRoutes } from './domains/prospects/routes'
app.route('/prospects', createProspectRoutes())
```

**Step 6: Write service tests, run, commit**

```bash
bun run test:run
git add -A
git commit -m "feat: add prospects domain (list, detail, CRUD)"
```

---

## Task 12: Campaigns Domain

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/campaigns/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/campaigns/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/campaigns/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/campaigns/service.ts`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`

Follow the same pattern as Task 11 (Prospects). Key differences:

- List view shows cards with status badges (pending/running/completed/failed)
- Detail view shows channel results table
- Create form includes multi-select for channels (12 options)
- Status update via PATCH with `hx-patch` on status dropdown
- Status filter via query params (`?status=running`)

**Routes:**
- `GET /campaigns` — list (full page or partial)
- `GET /campaigns/:id` — detail with channel results
- `GET /campaigns/new` — create form (modal partial)
- `POST /campaigns` — create
- `PATCH /campaigns/:id/status` — update status

**Commit:**

```bash
git add -A
git commit -m "feat: add campaigns domain (list, detail, create, status)"
```

---

## Task 13: Experiments Domain

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/experiments/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/experiments/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/experiments/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/experiments/service.ts`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`

Key features:
- List view: experiment cards with type badge and status
- Detail view: arm table with alpha/beta/traffic%, allocation preview
- Create form: name, type (dropdown), target metric
- Add arm form (inline partial)
- Allocate button → shows Thompson sampling result
- Reward recording form (arm dropdown + success/fail)

**Routes:**
- `GET /experiments` — list
- `GET /experiments/:id` — detail with arms
- `POST /experiments` — create
- `POST /experiments/:id/arms` — add arm (partial refresh)
- `GET /experiments/:id/allocate` — show allocation
- `POST /experiments/:id/reward` — record reward

**Commit:**

```bash
git add -A
git commit -m "feat: add experiments domain (MAB, arms, allocation, rewards)"
```

---

## Task 14: Workflows Domain + D3 DAG

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/workflows/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/workflows/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/workflows/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/workflows/service.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/workflows/dag-renderer.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/src/static/js/dag.js`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`

Key features:
- List view: workflows with status badges
- Detail view: split layout — DAG visualization (right) + node config (left)
- DAG rendered with D3.js + dagre layout algorithm
- Clicking a node swaps the left panel config via HTMX
- Create: POST goal → backend generates DAG → redirect to detail

**DAG rendering (`dag.js`):**

```javascript
// Uses D3 + dagre to layout and render workflow nodes/edges
// Receives graph data from a <script type="application/json"> block in the page
// Renders SVG with nodes as rounded rectangles, edges as curved paths
// Node colors based on status (pending=gray, running=blue, completed=green, failed=red, awaiting_approval=yellow)
// Click handler: hx-get="/workflows/:id/node/:nodeId" to swap left panel
```

**Routes:**
- `GET /workflows` — list
- `GET /workflows/:id` — detail with DAG
- `GET /workflows/new` — create form
- `POST /workflows` — create (AI-generates DAG)
- `GET /workflows/:id/node/:nodeId` — node config partial (left panel swap)

**Commit:**

```bash
git add -A
git commit -m "feat: add workflows domain with D3 DAG visualization"
```

---

## Task 15: Evolution + HITL Domain

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/evolution/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/evolution/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/evolution/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/evolution/service.ts`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`

Key features:
- **Evolution cycles:** vertical timeline showing generation #, strategy, best score
- **HITL queue:** card list of pending approval requests with SSE auto-refresh
- **HITL detail modal:** context preview, approve/reject/modify buttons
- **HITL badge:** sidebar count of pending requests (refreshed via SSE)
- **Start cycle form:** agent config dropdown, strategy, population size, generations

**Routes:**
- `GET /evolution` — split view: cycles timeline + HITL queue
- `GET /evolution/cycles` — cycles list partial
- `POST /evolution/cycles` — start new cycle
- `GET /evolution/hitl` — HITL queue partial
- `GET /evolution/hitl/:id` — HITL detail modal
- `POST /evolution/hitl/:id/decide` — approve/reject/modify
- `GET /evolution/hitl-count` — badge count partial (used by sidebar)

**Commit:**

```bash
git add -A
git commit -m "feat: add evolution + HITL domain with approval queue"
```

---

## Task 16: Sentiment Domain

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/sentiment/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/sentiment/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/sentiment/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/sentiment/service.ts`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`

Key features:
- **Signals tab:** sentiment articles table with score, brand, source, themes
- **Drift tab:** drift events with z-score, direction, baseline vs current
- **Competitive tab:** competitive summary with brand comparisons
- Chart.js area chart for sentiment trends (with drift markers)
- SSE-driven refresh on `sentiment:drift_detected`

**Routes:**
- `GET /sentiment` — full page with tabs
- `GET /sentiment/signals` — signals partial (query: brand, window, limit)
- `GET /sentiment/drift` — drift partial (query: brand)
- `GET /sentiment/competitive` — competitive partial (query: window)
- `GET /sentiment/chart-partial` — chart data partial for dashboard

**Commit:**

```bash
git add -A
git commit -m "feat: add sentiment domain with drift monitoring"
```

---

## Task 17: Accounts Domain (ABM)

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/accounts/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/accounts/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/accounts/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/accounts/service.ts`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`

Key features:
- List view: account cards sorted by score, with tier badges
- Detail view: account info, deals pipeline, signals timeline
- Create account form
- Create deal form (inline partial on detail page)
- Hot accounts sidebar widget (from signals API)

**Routes:**
- `GET /accounts` — list with score sorting
- `GET /accounts/:id` — detail with deals + signals
- `GET /accounts/new` — create form
- `POST /accounts` — create
- `POST /accounts/deals` — create deal (returns updated deal list)
- `GET /accounts/hot` — hot accounts partial (sidebar widget)

**Commit:**

```bash
git add -A
git commit -m "feat: add accounts domain (ABM, deals, hot accounts)"
```

---

## Task 18: Settings Domain

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/settings/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/settings/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/settings/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/settings/service.ts`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`

Key features:
- **Tab layout:** Zeluto | Brand Kits | Feeds | Scraper | Personas | Platform Connections
- **Zeluto tab:** config form (org ID, user ID, role, plan), sync actions, sync logs
- **Brand Kits tab:** list + create/edit form, content audit textarea
- **Feeds tab:** feed subscription CRUD with schedule (cron)
- **Scraper tab:** job list with status, dispatch new job form
- **Personas tab:** persona cards with OCEAN scores visualization
- **Platform Connections tab:** connected platforms list, "Connect" buttons (Phase 8 OAuth)

**Routes:**
- `GET /settings` — settings page with default tab
- `GET /settings/zeluto` — Zeluto config partial
- `POST /settings/zeluto/config` — save config
- `POST /settings/zeluto/sync/:type` — trigger sync
- `GET /settings/brand-kits` — brand kits partial
- `POST /settings/brand-kits` — create brand kit
- `POST /settings/brand-kits/:id/audit` — audit content
- `GET /settings/feeds` — feeds partial
- `POST /settings/feeds` — create feed
- `PATCH /settings/feeds/:id` — update feed
- `DELETE /settings/feeds/:id` — delete feed
- `GET /settings/scraper` — scraper jobs partial
- `POST /settings/scraper/jobs` — dispatch job
- `POST /settings/scraper/jobs/:id/cancel` — cancel job
- `GET /settings/personas` — personas partial
- `POST /settings/personas` — create persona
- `GET /settings/platforms` — platform connections partial

**Commit:**

```bash
git add -A
git commit -m "feat: add settings domain (zeluto, brand kits, feeds, scraper, personas, platforms)"
```

---

## Task 19: Onboarding Domain

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/onboarding/routes.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/onboarding/pages.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/onboarding/partials.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/onboarding/service.ts`
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`
- Test: `/Users/lsendel/Projects/indices_frontend/src/__tests__/onboarding-service.test.ts`

Key features:
- 5-step wizard with progress bar
- Each step POSTs to save, returns next step partial via HTMX
- Back/forward navigation with `hx-get`
- Steps: Company Info → Brand Kit → Zeluto Connection → First Audience → First Campaign

**Step 1: Write `service.ts`**

```typescript
export const ONBOARDING_STEPS = [
  { id: 1, label: 'Company Info', path: '/onboarding/step/1' },
  { id: 2, label: 'Brand Kit', path: '/onboarding/step/2' },
  { id: 3, label: 'Zeluto Connection', path: '/onboarding/step/3' },
  { id: 4, label: 'First Audience', path: '/onboarding/step/4' },
  { id: 5, label: 'First Campaign', path: '/onboarding/step/5' },
] as const

export function validateStep(step: number, data: Record<string, string>): string[] {
  const errors: string[] = []
  switch (step) {
    case 1:
      if (!data.companyName) errors.push('Company name is required')
      if (!data.industry) errors.push('Industry is required')
      break
    case 2:
      if (!data.brandName) errors.push('Brand name is required')
      break
    case 3:
      // Zeluto connection is optional
      break
    case 4:
      if (!data.segmentName) errors.push('Audience name is required')
      break
    case 5:
      if (!data.campaignGoal) errors.push('Campaign goal is required')
      break
  }
  return errors
}
```

**Step 2: Write pages + partials**

`OnboardingPage` — full page with progress bar and step container.
`StepPartial` — each step renders a form fragment swapped into `#step-container`.

**Step 3: Write routes**

```tsx
export function createOnboardingRoutes() {
  const router = new Hono<Env>()

  router.get('/', (c) => { /* render step 1 full page */ })
  router.get('/step/:step', (c) => { /* render step partial */ })
  router.post('/step/:step', async (c) => {
    /* validate, save via API, return next step partial */
  })

  return router
}
```

**Step 4: Write validation test**

```typescript
describe('validateStep', () => {
  it('step 1 requires company name and industry', () => {
    expect(validateStep(1, {})).toContain('Company name is required')
    expect(validateStep(1, { companyName: 'Test', industry: 'SaaS' })).toEqual([])
  })
})
```

**Step 5: Run tests, commit**

```bash
bun run test:run
git add -A
git commit -m "feat: add onboarding wizard domain (5-step)"
```

---

## Task 20: Register All Domain Routes + Login Page

**Files:**
- Modify: `/Users/lsendel/Projects/indices_frontend/src/index.tsx`
- Create: `/Users/lsendel/Projects/indices_frontend/src/domains/auth/routes.tsx`

**Step 1: Create login page route**

```tsx
// src/domains/auth/routes.tsx
import { Hono } from 'hono'
import { AuthLayout } from '../../shared/layouts/auth'

export function createAuthRoutes() {
  const router = new Hono()

  router.get('/login', (c) => {
    return c.html(
      <AuthLayout title="Sign In">
        <form method="post" action="/login" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" name="email" required
                   class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" name="password" required
                   class="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
          </div>
          <button type="submit"
                  class="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
            Sign In
          </button>
        </form>
      </AuthLayout>
    )
  })

  router.post('/login', async (c) => {
    // Forward login to better-auth backend
    const body = await c.req.parseBody()
    const apiUrl = c.get('apiBaseUrl') || c.env.API_BASE_URL
    const response = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: body.email, password: body.password }),
    })

    if (!response.ok) {
      return c.html(/* error partial */)
    }

    // Forward set-cookie header from backend
    const setCookie = response.headers.get('set-cookie')
    if (setCookie) {
      c.header('set-cookie', setCookie)
    }
    return c.redirect('/')
  })

  return router
}
```

**Step 2: Register all routes in `src/index.tsx`**

```tsx
import { Hono } from 'hono'
import { serveStatic } from 'hono/cloudflare-workers'
import { authMiddleware } from './shared/middleware/auth'
import { createAuthRoutes } from './domains/auth/routes'
import { createSseProxyRoutes } from './events/sse-proxy'
import { createAnalyticsRoutes } from './domains/analytics/routes'
import { createProspectRoutes } from './domains/prospects/routes'
import { createCampaignRoutes } from './domains/campaigns/routes'
import { createExperimentRoutes } from './domains/experiments/routes'
import { createWorkflowRoutes } from './domains/workflows/routes'
import { createEvolutionRoutes } from './domains/evolution/routes'
import { createSentimentRoutes } from './domains/sentiment/routes'
import { createAccountRoutes } from './domains/accounts/routes'
import { createSettingsRoutes } from './domains/settings/routes'
import { createOnboardingRoutes } from './domains/onboarding/routes'

type Env = {
  Bindings: { API_BASE_URL: string }
  Variables: { apiBaseUrl: string; cookies: string }
}

const app = new Hono<Env>()

// Inject env vars
app.use('*', async (c, next) => {
  c.set('apiBaseUrl', c.env.API_BASE_URL)
  c.set('cookies', c.req.header('cookie') || '')
  await next()
})

// Static files
app.get('/static/*', serveStatic({ root: './' }))

// Public routes
app.get('/health', (c) => c.json({ status: 'ok' }))
app.route('', createAuthRoutes())

// Auth guard
app.use('*', authMiddleware())

// SSE proxy
app.route('/sse', createSseProxyRoutes())

// Close modal helper
app.get('/close-modal', (c) => c.html(''))

// Domain routes
app.route('/', createAnalyticsRoutes())
app.route('/prospects', createProspectRoutes())
app.route('/campaigns', createCampaignRoutes())
app.route('/experiments', createExperimentRoutes())
app.route('/workflows', createWorkflowRoutes())
app.route('/evolution', createEvolutionRoutes())
app.route('/sentiment', createSentimentRoutes())
app.route('/accounts', createAccountRoutes())
app.route('/settings', createSettingsRoutes())
app.route('/onboarding', createOnboardingRoutes())

export default app
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: register all domain routes + login page"
```

---

## Task 21: Backend Refactor — Import from `@indices/contract`

**Files:**
- Modify: `/Users/lsendel/Projects/indices_app/package.json`
- Modify: `/Users/lsendel/Projects/indices_app/src/types/api.ts`
- Modify: `/Users/lsendel/Projects/indices_app/src/routes/*.ts` (13+ files)

**Step 1: Link contract package to backend**

```bash
cd /Users/lsendel/Projects/indices_app
bun link @indices/contract
```

Add to `package.json` dependencies:

```json
"@indices/contract": "link:../indices_contract"
```

**Step 2: Update `src/types/api.ts`**

Replace local Zod schemas with re-exports from `@indices/contract`:

```typescript
// src/types/api.ts
// Re-export all schemas from the shared contract
export {
  prospectCreate,
  prospectUpdate,
  campaignCreate,
  segmentCreate,
  paginationQuery,
  signalCapture,
  accountCreate,
  dealCreate,
  experimentCreate,
  armCreate,
  armReward,
  personaCreate,
  brandKitCreate,
  zelutoConfigCreate,
  contentSyncRequest,
  contactSyncRequest,
  campaignSyncRequest,
  experimentSyncRequest,
  workflowCreate,
  hitlDecision,
  evolutionStart,
  promptVersionCreate,
  feedSubscriptionCreate,
  feedSubscriptionUpdate,
  scrapeJobDispatch,
  scrapeJobCancel,
} from '@indices/contract'

// Re-export types
export type {
  ProspectCreate,
  ProspectUpdate,
  CampaignCreate,
  // ... all types
} from '@indices/contract'
```

**Step 3: Run existing backend tests to verify nothing breaks**

```bash
cd /Users/lsendel/Projects/indices_app
bun run test:run
```

Expected: all existing tests PASS (schemas are identical)

**Step 4: Commit**

```bash
git add package.json src/types/api.ts
git commit -m "refactor: import Zod schemas from @indices/contract"
```

---

## Task 22: Integration Test — Playwright E2E

**Files:**
- Create: `/Users/lsendel/Projects/indices_frontend/playwright.config.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/e2e/dashboard.spec.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/e2e/prospects.spec.ts`
- Create: `/Users/lsendel/Projects/indices_frontend/e2e/hitl.spec.ts`

**Step 1: Install Playwright**

```bash
cd /Users/lsendel/Projects/indices_frontend
bun add -d @playwright/test
npx playwright install chromium
```

**Step 2: Create `playwright.config.ts`**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npx wrangler dev --port 3000',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000',
  },
})
```

**Step 3: Write 3 E2E tests for critical flows**

```typescript
// e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test'

test('dashboard loads stat cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('text=Prospects')).toBeVisible()
  await expect(page.locator('text=Campaigns')).toBeVisible()
})

// e2e/prospects.spec.ts
test('create and view prospect', async ({ page }) => {
  await page.goto('/prospects')
  await page.click('text=Add Prospect')
  await page.fill('input[name="name"]', 'Test User')
  await page.fill('input[name="company"]', 'Test Corp')
  await page.fill('input[name="role"]', 'CTO')
  await page.click('button[type="submit"]')
  await expect(page.locator('text=Test User')).toBeVisible()
})

// e2e/hitl.spec.ts
test('HITL queue shows pending requests', async ({ page }) => {
  await page.goto('/evolution')
  await expect(page.locator('#hitl-list')).toBeVisible()
})
```

**Step 4: Run E2E tests (requires backend running)**

```bash
# Terminal 1: start backend
cd /Users/lsendel/Projects/indices_app && bun run dev

# Terminal 2: run E2E
cd /Users/lsendel/Projects/indices_frontend
bun run test:e2e
```

**Step 5: Commit**

```bash
git add -A
git commit -m "test: add Playwright E2E tests for dashboard, prospects, HITL"
```

---

## Task 23: Final Wiring + Build Verification

**Files:**
- Modify: `/Users/lsendel/Projects/indices_frontend/package.json` (verify all deps)
- Verify: all imports resolve, no TypeScript errors

**Step 1: TypeScript check**

```bash
cd /Users/lsendel/Projects/indices_frontend
npx tsc --noEmit
```

Fix any type errors.

**Step 2: Build CSS**

```bash
bun run css:build
```

**Step 3: Wrangler dev check**

```bash
npx wrangler dev
```

Verify:
- Health check: `curl http://localhost:8787/health` returns `{"status":"ok"}`
- Login redirect: `curl -I http://localhost:8787/` returns 302 to `/login`
- Static files: `curl http://localhost:8787/static/css/app.css` returns CSS
- Login page: `curl http://localhost:8787/login` returns HTML

**Step 4: Run all unit tests**

```bash
bun run test:run
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final wiring and build verification"
```

---

## Summary

| Task | Domain | Files | Key Deliverable |
|------|--------|-------|-----------------|
| 1 | Contract | 5 | `@indices/contract` scaffold + shared schemas |
| 2 | Contract | 5 | Prospect + campaign + segment contracts |
| 3 | Contract | 5 | Signal + experiment + workflow + evolution contracts |
| 4 | Contract | 11 | All remaining domain contracts + root contract |
| 5 | Frontend | 4 | `indices_frontend` scaffold (wrangler, Hono) |
| 6 | Frontend | 3 | API client (ts-rest) + auth middleware |
| 7 | Frontend | 5 | Shell layout + auth layout + Tailwind |
| 8 | Frontend | 8 | Shared components (table, pagination, modal, etc.) |
| 9 | Frontend | 4 | SSE proxy + event handlers + client JS |
| 10 | Analytics | 6 | Dashboard with stat cards + Chart.js |
| 11 | Prospects | 5 | CRUD list/detail with table + forms |
| 12 | Campaigns | 4 | Card list + detail + channel results |
| 13 | Experiments | 4 | MAB builder + arms + allocation + rewards |
| 14 | Workflows | 6 | DAG builder with D3.js + dagre |
| 15 | Evolution | 4 | Timeline + HITL approval queue |
| 16 | Sentiment | 4 | Signals/drift/competitive tabs + charts |
| 17 | Accounts | 4 | ABM list + deals pipeline + hot accounts |
| 18 | Settings | 4 | Zeluto/brand kits/feeds/scraper/personas/platforms |
| 19 | Onboarding | 5 | 5-step wizard with validation |
| 20 | Frontend | 2 | All routes registered + login page |
| 21 | Backend | 2 | Refactor to import from @indices/contract |
| 22 | Testing | 4 | Playwright E2E (3 critical flows) |
| 23 | Frontend | 1 | Build verification + final wiring |

**Total: 23 tasks across 3 projects**
