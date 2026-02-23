# Phase 10: Closed-Loop Intelligence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire all existing building blocks (engagement, EvoAgentX, sentiment, experiments, signals) into autonomous event-driven feedback loops with an AI-configurable rule engine, channel grouping, and full prompt lineage tracking.

**Architecture:** In-process typed event bus with pipeline handlers. Events cascade: engagement → threshold → optimization → prompt storage → content generation. A rule engine evaluates conditions on every event and can gate, modify, route, notify, or generate campaigns. Channel groups (static, behavioral, audience-matched) let rules target collections of channels.

**Tech Stack:** Hono 4, Drizzle ORM (Neon Postgres), Vitest, LLMProvider (Phase 7), existing EvoAgentX services

**Prerequisite:** Phase 7 PR #10 must be merged first (migrates `OpenAIAdapter` → `LLMProvider`).

**Design doc:** `docs/plans/2026-02-23-phase10-closed-loop-intelligence-design.md`

---

## Task 1: Event Bus Core

**Files:**
- Create: `src/services/loop/event-bus.ts`
- Create: `src/services/loop/types.ts`
- Test: `tests/services/loop/event-bus.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/loop/event-bus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createEventBus, type LoopEvent } from '../../src/services/loop/event-bus'

describe('EventBus', () => {
	it('should emit and receive typed events', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('engagement.collected', handler)

		await bus.emit('tenant-1', 'engagement.collected', { channel: 'email', score: 42 })

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				type: 'engagement.collected',
				payload: { channel: 'email', score: 42 },
			}),
		)
	})

	it('should not cross tenant boundaries', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('engagement.collected', handler)

		await bus.emit('tenant-1', 'engagement.collected', { channel: 'email', score: 10 })
		await bus.emit('tenant-2', 'engagement.collected', { channel: 'sms', score: 20 })

		expect(handler).toHaveBeenCalledTimes(2)
		expect(handler.mock.calls[0][0].tenantId).toBe('tenant-1')
		expect(handler.mock.calls[1][0].tenantId).toBe('tenant-2')
	})

	it('should support wildcard handlers', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.onAny(handler)

		await bus.emit('tenant-1', 'engagement.collected', {})
		await bus.emit('tenant-1', 'sentiment.drift_detected', {})

		expect(handler).toHaveBeenCalledTimes(2)
	})

	it('should catch handler errors without breaking other handlers', async () => {
		const bus = createEventBus()
		const badHandler = vi.fn().mockRejectedValue(new Error('boom'))
		const goodHandler = vi.fn()
		bus.on('engagement.collected', badHandler)
		bus.on('engagement.collected', goodHandler)

		await bus.emit('tenant-1', 'engagement.collected', {})

		expect(badHandler).toHaveBeenCalled()
		expect(goodHandler).toHaveBeenCalled()
	})

	it('should return event history', async () => {
		const bus = createEventBus()
		await bus.emit('tenant-1', 'engagement.collected', { score: 1 })
		await bus.emit('tenant-1', 'engagement.collected', { score: 2 })
		await bus.emit('tenant-2', 'engagement.collected', { score: 3 })

		const history = bus.history('tenant-1', 'engagement.collected')
		expect(history).toHaveLength(2)
		expect(history[0].payload.score).toBe(1)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/loop/event-bus.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Write types**

```typescript
// src/services/loop/types.ts
export type EventType =
	| 'engagement.collected'
	| 'engagement.threshold_reached'
	| 'sentiment.drift_detected'
	| 'experiment.reward_received'
	| 'delivery.completed'
	| 'optimization.completed'
	| 'campaign.auto_generated'
	| 'system.circuit_breaker'

export interface LoopEvent {
	id: string
	tenantId: string
	type: EventType
	payload: Record<string, unknown>
	timestamp: Date
}

export type EventHandler = (event: LoopEvent) => Promise<void> | void
```

**Step 4: Write event bus implementation**

```typescript
// src/services/loop/event-bus.ts
import { randomUUID } from 'crypto'
import type { EventType, LoopEvent, EventHandler } from './types'

export type { LoopEvent }

export interface EventBus {
	emit(tenantId: string, type: EventType, payload: Record<string, unknown>): Promise<void>
	on(type: EventType, handler: EventHandler): void
	onAny(handler: EventHandler): void
	history(tenantId: string, type?: EventType): LoopEvent[]
}

export function createEventBus(): EventBus {
	const handlers = new Map<EventType, EventHandler[]>()
	const wildcardHandlers: EventHandler[] = []
	const eventLog: LoopEvent[] = []

	return {
		async emit(tenantId, type, payload) {
			const event: LoopEvent = {
				id: randomUUID(),
				tenantId,
				type,
				payload,
				timestamp: new Date(),
			}
			eventLog.push(event)

			const typedHandlers = handlers.get(type) ?? []
			const allHandlers = [...typedHandlers, ...wildcardHandlers]

			for (const handler of allHandlers) {
				try {
					await handler(event)
				} catch (err) {
					console.error(`EventBus handler error for ${type}:`, err)
				}
			}
		},

		on(type, handler) {
			const existing = handlers.get(type) ?? []
			existing.push(handler)
			handlers.set(type, existing)
		},

		onAny(handler) {
			wildcardHandlers.push(handler)
		},

		history(tenantId, type?) {
			return eventLog.filter(
				(e) => e.tenantId === tenantId && (!type || e.type === type),
			)
		},
	}
}
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/services/loop/event-bus.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/services/loop/types.ts src/services/loop/event-bus.ts tests/services/loop/event-bus.test.ts
git commit -m "feat(phase10): add typed event bus with tenant isolation"
```

---

## Task 2: Loop DB Schema — Pipelines, Rules, Channel Groups

**Files:**
- Create: `src/db/schema/loop-pipelines.ts`
- Create: `src/db/schema/loop-rules.ts`
- Create: `src/db/schema/loop-channel-groups.ts`
- Create: `src/db/schema/loop-events.ts`
- Modify: `src/db/schema/index.ts`
- Test: `tests/db/loop-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/loop-schema.test.ts
import { describe, it, expect } from 'vitest'
import { loopPipelines } from '../../src/db/schema/loop-pipelines'
import { loopRules } from '../../src/db/schema/loop-rules'
import { loopChannelGroups } from '../../src/db/schema/loop-channel-groups'
import { loopEvents } from '../../src/db/schema/loop-events'

describe('loop schema', () => {
	it('loopPipelines has required columns', () => {
		expect(loopPipelines.id).toBeDefined()
		expect(loopPipelines.tenantId).toBeDefined()
		expect(loopPipelines.name).toBeDefined()
		expect(loopPipelines.eventType).toBeDefined()
		expect(loopPipelines.config).toBeDefined()
		expect(loopPipelines.active).toBeDefined()
	})

	it('loopRules has required columns', () => {
		expect(loopRules.id).toBeDefined()
		expect(loopRules.tenantId).toBeDefined()
		expect(loopRules.conditions).toBeDefined()
		expect(loopRules.actions).toBeDefined()
		expect(loopRules.scope).toBeDefined()
		expect(loopRules.priority).toBeDefined()
	})

	it('loopChannelGroups has required columns', () => {
		expect(loopChannelGroups.id).toBeDefined()
		expect(loopChannelGroups.tenantId).toBeDefined()
		expect(loopChannelGroups.name).toBeDefined()
		expect(loopChannelGroups.type).toBeDefined()
		expect(loopChannelGroups.channels).toBeDefined()
	})

	it('loopEvents has required columns', () => {
		expect(loopEvents.id).toBeDefined()
		expect(loopEvents.tenantId).toBeDefined()
		expect(loopEvents.eventType).toBeDefined()
		expect(loopEvents.payload).toBeDefined()
		expect(loopEvents.outcome).toBeDefined()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/db/loop-schema.test.ts`
Expected: FAIL with "Cannot find module"

**Step 3: Create schema files**

```typescript
// src/db/schema/loop-pipelines.ts
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const loopPipelines = pgTable('loop_pipelines', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	eventType: text('event_type').notNull(),
	config: jsonb('config').default({}).notNull(),
	active: boolean('active').default(true).notNull(),
	lastRunAt: timestamp('last_run_at', { withTimezone: true }),
	runCount: integer('run_count').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_loop_pipelines_tenant').on(table.tenantId),
	index('idx_loop_pipelines_event').on(table.eventType),
])
```

```typescript
// src/db/schema/loop-rules.ts
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const loopRules = pgTable('loop_rules', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	conditions: jsonb('conditions').notNull(),
	actions: jsonb('actions').notNull(),
	scope: jsonb('scope').default({}).notNull(),
	priority: integer('priority').default(50).notNull(),
	cooldownMinutes: integer('cooldown_minutes').default(0).notNull(),
	lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
	fireCount: integer('fire_count').default(0).notNull(),
	active: boolean('active').default(true).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_loop_rules_tenant_active').on(table.tenantId, table.active),
])
```

```typescript
// src/db/schema/loop-channel-groups.ts
import { pgTable, uuid, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const loopChannelGroups = pgTable('loop_channel_groups', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	type: text('type', { enum: ['static', 'behavioral', 'audience'] }).notNull(),
	channels: text('channels').array().notNull(),
	criteria: jsonb('criteria'),
	autoRefresh: boolean('auto_refresh').default(false).notNull(),
	refreshedAt: timestamp('refreshed_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_channel_groups_tenant').on(table.tenantId),
	index('idx_channel_groups_refresh').on(table.tenantId, table.autoRefresh),
])
```

```typescript
// src/db/schema/loop-events.ts
import { pgTable, uuid, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const loopEvents = pgTable('loop_events', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	eventType: text('event_type').notNull(),
	payload: jsonb('payload').notNull(),
	pipelineId: uuid('pipeline_id'),
	ruleIds: uuid('rule_ids').array(),
	outcome: text('outcome', { enum: ['processed', 'gated', 'error', 'skipped'] }).notNull(),
	outcomeData: jsonb('outcome_data'),
	durationMs: integer('duration_ms'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_loop_events_tenant_time').on(table.tenantId, table.createdAt),
	index('idx_loop_events_type').on(table.eventType),
])
```

**Step 4: Update barrel export**

Add to `src/db/schema/index.ts`:
```typescript
export * from './loop-pipelines'
export * from './loop-rules'
export * from './loop-channel-groups'
export * from './loop-events'
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/db/loop-schema.test.ts`
Expected: PASS

**Step 6: Generate Drizzle migration**

Run: `bunx drizzle-kit generate`

**Step 7: Commit**

```bash
git add src/db/schema/loop-pipelines.ts src/db/schema/loop-rules.ts src/db/schema/loop-channel-groups.ts src/db/schema/loop-events.ts src/db/schema/index.ts src/db/migrations/ tests/db/loop-schema.test.ts
git commit -m "feat(phase10): add loop schema — pipelines, rules, channel groups, events"
```

---

## Task 3: Prompt Lineage Schema

**Files:**
- Create: `src/db/schema/loop-prompt-versions.ts`
- Create: `src/db/schema/content-lineage.ts`
- Modify: `src/db/schema/index.ts`
- Test: `tests/db/lineage-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/lineage-schema.test.ts
import { describe, it, expect } from 'vitest'
import { loopPromptVersions } from '../../src/db/schema/loop-prompt-versions'
import { contentLineage } from '../../src/db/schema/content-lineage'

describe('lineage schema', () => {
	it('loopPromptVersions has required columns', () => {
		expect(loopPromptVersions.id).toBeDefined()
		expect(loopPromptVersions.tenantId).toBeDefined()
		expect(loopPromptVersions.channel).toBeDefined()
		expect(loopPromptVersions.systemPrompt).toBeDefined()
		expect(loopPromptVersions.instruction).toBeDefined()
		expect(loopPromptVersions.version).toBeDefined()
		expect(loopPromptVersions.parentId).toBeDefined()
		expect(loopPromptVersions.status).toBeDefined()
	})

	it('contentLineage has required columns', () => {
		expect(contentLineage.id).toBeDefined()
		expect(contentLineage.tenantId).toBeDefined()
		expect(contentLineage.promptVersionId).toBeDefined()
		expect(contentLineage.channel).toBeDefined()
		expect(contentLineage.engagementScore).toBeDefined()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/db/lineage-schema.test.ts`
Expected: FAIL

**Step 3: Create schema files**

```typescript
// src/db/schema/loop-prompt-versions.ts
import { pgTable, uuid, text, timestamp, integer, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const loopPromptVersions = pgTable('loop_prompt_versions', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	channel: text('channel').notNull(),
	channelGroup: text('channel_group'),
	systemPrompt: text('system_prompt').notNull(),
	instruction: text('instruction').notNull(),
	version: integer('version').notNull(),
	parentId: uuid('parent_id'),
	strategy: text('strategy'),
	qualityScore: real('quality_score'),
	engagementScore: real('engagement_score'),
	status: text('status', { enum: ['candidate', 'active', 'retired', 'rejected'] }).default('candidate').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	activatedAt: timestamp('activated_at', { withTimezone: true }),
}, (table) => [
	index('idx_loop_prompts_active').on(table.tenantId, table.channel, table.status),
	index('idx_loop_prompts_parent').on(table.parentId),
])
```

```typescript
// src/db/schema/content-lineage.ts
import { pgTable, uuid, text, timestamp, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { loopPromptVersions } from './loop-prompt-versions'

export const contentLineage = pgTable('content_lineage', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	promptVersionId: uuid('prompt_version_id').notNull().references(() => loopPromptVersions.id),
	publishedContentId: uuid('published_content_id'),
	campaignId: uuid('campaign_id'),
	experimentArmId: uuid('experiment_arm_id'),
	channel: text('channel').notNull(),
	generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
	engagementScore: real('engagement_score'),
	engagementUpdatedAt: timestamp('engagement_updated_at', { withTimezone: true }),
}, (table) => [
	index('idx_lineage_content').on(table.publishedContentId),
	index('idx_lineage_prompt').on(table.promptVersionId),
	index('idx_lineage_tenant').on(table.tenantId),
])
```

**Step 4: Update barrel export**

Add to `src/db/schema/index.ts`:
```typescript
export * from './loop-prompt-versions'
export * from './content-lineage'
```

**Step 5: Run test, generate migration, commit**

Run: `bunx vitest run tests/db/lineage-schema.test.ts`
Expected: PASS

Run: `bunx drizzle-kit generate`

```bash
git add src/db/schema/loop-prompt-versions.ts src/db/schema/content-lineage.ts src/db/schema/index.ts src/db/migrations/ tests/db/lineage-schema.test.ts
git commit -m "feat(phase10): add prompt lineage and content lineage schema"
```

---

## Task 4: Rule Engine

**Files:**
- Create: `src/services/loop/rule-engine.ts`
- Test: `tests/services/loop/rule-engine.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/loop/rule-engine.test.ts
import { describe, it, expect } from 'vitest'
import { evaluateRules, type Rule, type RuleEvaluation } from '../../src/services/loop/rule-engine'

const baseEvent = {
	tenantId: 'tenant-1',
	type: 'engagement.collected' as const,
	payload: { channel: 'email', score: 42, delta: 0.2 },
}

describe('Rule Engine', () => {
	it('should match eq condition', () => {
		const rule: Rule = {
			id: 'r1', name: 'test', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
			actions: [{ type: 'notify', message: 'matched' }],
			scope: {},
		}
		const result = evaluateRules([rule], baseEvent.payload, {})
		expect(result.matched).toHaveLength(1)
		expect(result.gated).toBe(false)
	})

	it('should match gt condition', () => {
		const rule: Rule = {
			id: 'r1', name: 'test', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'score', op: 'gt', value: 40 }],
			actions: [{ type: 'modify', set: { strategy: 'textgrad' } }],
			scope: {},
		}
		const result = evaluateRules([rule], baseEvent.payload, {})
		expect(result.matched).toHaveLength(1)
	})

	it('should NOT match when condition fails', () => {
		const rule: Rule = {
			id: 'r1', name: 'test', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'sms' }],
			actions: [{ type: 'notify', message: 'no match' }],
			scope: {},
		}
		const result = evaluateRules([rule], baseEvent.payload, {})
		expect(result.matched).toHaveLength(0)
	})

	it('should gate pipeline when gate action matches', () => {
		const rule: Rule = {
			id: 'r1', name: 'gate-email', priority: 1, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
			actions: [{ type: 'gate' }],
			scope: {},
		}
		const result = evaluateRules([rule], baseEvent.payload, {})
		expect(result.gated).toBe(true)
	})

	it('should merge modify actions', () => {
		const rules: Rule[] = [
			{
				id: 'r1', name: 'a', priority: 10, cooldownMinutes: 0,
				conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
				actions: [{ type: 'modify', set: { strategy: 'textgrad' } }],
				scope: {},
			},
			{
				id: 'r2', name: 'b', priority: 20, cooldownMinutes: 0,
				conditions: [{ field: 'score', op: 'gt', value: 30 }],
				actions: [{ type: 'modify', set: { cadence_min: 120 } }],
				scope: {},
			},
		]
		const result = evaluateRules(rules, baseEvent.payload, {})
		expect(result.configOverrides).toEqual({ strategy: 'textgrad', cadence_min: 120 })
	})

	it('should support in_group operator', () => {
		const rule: Rule = {
			id: 'r1', name: 'test', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'in_group', value: 'high-performers' }],
			actions: [{ type: 'notify', message: 'in group' }],
			scope: {},
		}
		const context = { groups: { 'high-performers': ['email', 'linkedin'] } }
		const result = evaluateRules([rule], baseEvent.payload, context)
		expect(result.matched).toHaveLength(1)
	})

	it('should evaluate rules in priority order', () => {
		const rules: Rule[] = [
			{
				id: 'r2', name: 'low-priority', priority: 50, cooldownMinutes: 0,
				conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
				actions: [{ type: 'modify', set: { strategy: 'ga' } }],
				scope: {},
			},
			{
				id: 'r1', name: 'high-priority', priority: 1, cooldownMinutes: 0,
				conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
				actions: [{ type: 'gate' }],
				scope: {},
			},
		]
		const result = evaluateRules(rules, baseEvent.payload, {})
		expect(result.gated).toBe(true)
		expect(result.configOverrides).toEqual({})
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/loop/rule-engine.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/services/loop/rule-engine.ts

export interface Condition {
	field: string
	op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'between' | 'in_group' | 'not_in_group'
	value: unknown
}

export interface Action {
	type: 'gate' | 'modify' | 'route' | 'notify' | 'generate'
	set?: Record<string, unknown>
	message?: string
	pipeline?: string
	channels?: string[]
	goal?: string
	tone?: string
}

export interface Rule {
	id: string
	name: string
	priority: number
	cooldownMinutes: number
	conditions: Condition[]
	actions: Action[]
	scope: Record<string, unknown>
	lastFiredAt?: Date
}

export interface RuleEvaluation {
	matched: Rule[]
	gated: boolean
	configOverrides: Record<string, unknown>
	notifications: Action[]
	routes: Action[]
	generates: Action[]
}

interface EvalContext {
	groups?: Record<string, string[]>
	[key: string]: unknown
}

function resolveField(field: string, payload: Record<string, unknown>, context: EvalContext): unknown {
	if (field in payload) return payload[field]
	const parts = field.split('.')
	let current: unknown = { ...payload, ...context }
	for (const part of parts) {
		if (current == null || typeof current !== 'object') return undefined
		current = (current as Record<string, unknown>)[part]
	}
	return current
}

function evaluateCondition(condition: Condition, payload: Record<string, unknown>, context: EvalContext): boolean {
	const { field, op, value } = condition

	if (op === 'in_group') {
		const channel = payload.channel as string
		const groups = context.groups ?? {}
		const members = groups[value as string] ?? []
		return members.includes(channel)
	}

	if (op === 'not_in_group') {
		const channel = payload.channel as string
		const groups = context.groups ?? {}
		const members = groups[value as string] ?? []
		return !members.includes(channel)
	}

	const resolved = resolveField(field, payload, context)

	switch (op) {
		case 'eq': return resolved === value
		case 'neq': return resolved !== value
		case 'gt': return (resolved as number) > (value as number)
		case 'gte': return (resolved as number) >= (value as number)
		case 'lt': return (resolved as number) < (value as number)
		case 'lte': return (resolved as number) <= (value as number)
		case 'in': return Array.isArray(value) && value.includes(resolved)
		case 'not_in': return Array.isArray(value) && !value.includes(resolved)
		case 'contains': {
			if (typeof resolved === 'string') return resolved.includes(value as string)
			if (Array.isArray(resolved)) return resolved.includes(value)
			return false
		}
		case 'between': {
			const [min, max] = value as [number, number]
			return (resolved as number) >= min && (resolved as number) <= max
		}
		default: return false
	}
}

export function evaluateRules(
	rules: Rule[],
	payload: Record<string, unknown>,
	context: EvalContext,
): RuleEvaluation {
	const sorted = [...rules].sort((a, b) => a.priority - b.priority)

	const result: RuleEvaluation = {
		matched: [],
		gated: false,
		configOverrides: {},
		notifications: [],
		routes: [],
		generates: [],
	}

	for (const rule of sorted) {
		const allMatch = rule.conditions.every((c) => evaluateCondition(c, payload, context))
		if (!allMatch) continue

		result.matched.push(rule)

		for (const action of rule.actions) {
			switch (action.type) {
				case 'gate':
					result.gated = true
					return result
				case 'modify':
					Object.assign(result.configOverrides, action.set ?? {})
					break
				case 'notify':
					result.notifications.push(action)
					break
				case 'route':
					result.routes.push(action)
					break
				case 'generate':
					result.generates.push(action)
					break
			}
		}
	}

	return result
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/loop/rule-engine.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/loop/rule-engine.ts tests/services/loop/rule-engine.test.ts
git commit -m "feat(phase10): add rule engine with condition evaluation and action dispatch"
```

---

## Task 5: Channel Group Service

**Files:**
- Create: `src/services/loop/channel-groups.ts`
- Test: `tests/services/loop/channel-groups.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/loop/channel-groups.test.ts
import { describe, it, expect } from 'vitest'
import { getDefaultGroups, resolveGroupMembers, refreshBehavioralGroups } from '../../src/services/loop/channel-groups'

describe('Channel Groups', () => {
	it('should return 7 default groups', () => {
		const groups = getDefaultGroups()
		expect(groups).toHaveLength(7)
		expect(groups.find((g) => g.name === 'all-channels')?.channels).toHaveLength(11)
		expect(groups.find((g) => g.name === 'social')?.type).toBe('static')
		expect(groups.find((g) => g.name === 'high-performers')?.type).toBe('behavioral')
	})

	it('should resolve static group members directly', () => {
		const members = resolveGroupMembers({
			name: 'social', type: 'static',
			channels: ['linkedin', 'facebook', 'instagram', 'tiktok'],
			criteria: null,
		})
		expect(members).toEqual(['linkedin', 'facebook', 'instagram', 'tiktok'])
	})

	it('should refresh behavioral groups from engagement data', () => {
		const channelScores = {
			email: 85, linkedin: 72, sms: 45, tiktok: 30,
			facebook: 60, instagram: 55, whatsapp: 40,
			voice: 35, youtube: 50, vimeo: 25, video: 20,
		}
		const groups = refreshBehavioralGroups(channelScores)
		expect(groups['high-performers']).toContain('email')
		expect(groups['high-performers']).toContain('linkedin')
		expect(groups['underperformers']).toContain('vimeo')
		expect(groups['underperformers']).toContain('video')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/loop/channel-groups.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/services/loop/channel-groups.ts
import { SUPPORTED_CHANNELS } from '../../adapters/channels'

export interface ChannelGroupDef {
	name: string
	type: 'static' | 'behavioral' | 'audience'
	channels: string[]
	criteria: Record<string, unknown> | null
	autoRefresh?: boolean
}

export function getDefaultGroups(): ChannelGroupDef[] {
	return [
		{ name: 'all-channels', type: 'static', channels: [...SUPPORTED_CHANNELS], criteria: null },
		{ name: 'social', type: 'static', channels: ['linkedin', 'facebook', 'instagram', 'tiktok'], criteria: null },
		{ name: 'video', type: 'static', channels: ['tiktok', 'youtube', 'vimeo', 'video'], criteria: null },
		{ name: 'direct-messaging', type: 'static', channels: ['email', 'sms', 'whatsapp', 'voice'], criteria: null },
		{
			name: 'high-performers', type: 'behavioral', channels: [], autoRefresh: true,
			criteria: { metric: 'engagement_score', method: 'percentile', threshold: 75, comparison: 'above' },
		},
		{
			name: 'underperformers', type: 'behavioral', channels: [], autoRefresh: true,
			criteria: { metric: 'engagement_score', method: 'percentile', threshold: 25, comparison: 'below' },
		},
		{
			name: 'growing', type: 'behavioral', channels: [], autoRefresh: true,
			criteria: { metric: 'engagement_score', method: 'trend', direction: 'positive', window_days: 28 },
		},
	]
}

export function resolveGroupMembers(group: ChannelGroupDef): string[] {
	if (group.type === 'static') return group.channels
	return group.channels
}

export function refreshBehavioralGroups(
	channelScores: Record<string, number>,
): Record<string, string[]> {
	const entries = Object.entries(channelScores).sort((a, b) => b[1] - a[1])
	const count = entries.length
	const topQuartile = Math.ceil(count * 0.25)
	const bottomQuartile = Math.ceil(count * 0.25)

	return {
		'high-performers': entries.slice(0, topQuartile).map(([ch]) => ch),
		'underperformers': entries.slice(count - bottomQuartile).map(([ch]) => ch),
		'growing': [], // Requires historical data — populated by pipeline handler
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/loop/channel-groups.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/loop/channel-groups.ts tests/services/loop/channel-groups.test.ts
git commit -m "feat(phase10): add channel group service with default groups and behavioral refresh"
```

---

## Task 6: Pipeline Executor

**Files:**
- Create: `src/services/loop/pipeline-executor.ts`
- Test: `tests/services/loop/pipeline-executor.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/loop/pipeline-executor.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createPipelineExecutor } from '../../src/services/loop/pipeline-executor'
import { createEventBus } from '../../src/services/loop/event-bus'
import type { Rule } from '../../src/services/loop/rule-engine'

describe('Pipeline Executor', () => {
	it('should execute pipeline action when event matches', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		executor.register({
			name: 'test-pipeline',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [],
			getContext: async () => ({}),
		})

		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })
		expect(action).toHaveBeenCalled()
	})

	it('should skip pipeline when gated by rule', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		const gateRule: Rule = {
			id: 'r1', name: 'gate', priority: 1, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
			actions: [{ type: 'gate' }],
			scope: {},
		}

		executor.register({
			name: 'test-pipeline',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [gateRule],
			getContext: async () => ({}),
		})

		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })
		expect(action).not.toHaveBeenCalled()
	})

	it('should pass merged config overrides to action', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		const rule: Rule = {
			id: 'r1', name: 'boost', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
			actions: [{ type: 'modify', set: { strategy: 'textgrad' } }],
			scope: {},
		}

		executor.register({
			name: 'test-pipeline',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [rule],
			getContext: async () => ({}),
		})

		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })
		expect(action).toHaveBeenCalledWith(
			expect.objectContaining({ payload: { channel: 'email' } }),
			expect.objectContaining({ strategy: 'textgrad' }),
		)
	})

	it('should respect pipeline cadence (skip if too recent)', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		executor.register({
			name: 'test-pipeline',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [],
			getContext: async () => ({}),
			cadenceMin: 60,
		})

		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })
		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })

		expect(action).toHaveBeenCalledTimes(1)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/loop/pipeline-executor.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/services/loop/pipeline-executor.ts
import type { EventBus, LoopEvent } from './event-bus'
import type { EventType } from './types'
import { evaluateRules, type Rule } from './rule-engine'

export interface PipelineConfig {
	name: string
	eventType: EventType
	action: (event: LoopEvent, configOverrides: Record<string, unknown>) => Promise<void> | void
	getRules: (tenantId: string) => Promise<Rule[]>
	getContext: (tenantId: string) => Promise<Record<string, unknown>>
	cadenceMin?: number
}

export interface PipelineExecutor {
	register(config: PipelineConfig): void
}

export function createPipelineExecutor(bus: EventBus): PipelineExecutor {
	const lastRunMap = new Map<string, number>()

	return {
		register(config) {
			bus.on(config.eventType, async (event) => {
				const cadenceKey = `${config.name}:${event.tenantId}`
				const now = Date.now()

				if (config.cadenceMin) {
					const lastRun = lastRunMap.get(cadenceKey) ?? 0
					if (now - lastRun < config.cadenceMin * 60_000) return
				}

				const rules = await config.getRules(event.tenantId)
				const context = await config.getContext(event.tenantId)
				const evaluation = evaluateRules(rules, event.payload, context)

				if (evaluation.gated) return

				lastRunMap.set(cadenceKey, now)
				await config.action(event, evaluation.configOverrides)
			})
		},
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/loop/pipeline-executor.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/loop/pipeline-executor.ts tests/services/loop/pipeline-executor.test.ts
git commit -m "feat(phase10): add pipeline executor with rule evaluation and cadence control"
```

---

## Task 7: Barrel Export + Loop Service Index

**Files:**
- Create: `src/services/loop/index.ts`
- Test: `tests/services/loop/index.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/loop/index.test.ts
import { describe, it, expect } from 'vitest'
import { createEventBus, createPipelineExecutor, evaluateRules, getDefaultGroups } from '../../src/services/loop'

describe('loop barrel exports', () => {
	it('exports all core components', () => {
		expect(createEventBus).toBeTypeOf('function')
		expect(createPipelineExecutor).toBeTypeOf('function')
		expect(evaluateRules).toBeTypeOf('function')
		expect(getDefaultGroups).toBeTypeOf('function')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/loop/index.test.ts`
Expected: FAIL

**Step 3: Create barrel export**

```typescript
// src/services/loop/index.ts
export { createEventBus, type EventBus, type LoopEvent } from './event-bus'
export { type EventType, type EventHandler } from './types'
export { evaluateRules, type Rule, type Condition, type Action, type RuleEvaluation } from './rule-engine'
export { createPipelineExecutor, type PipelineConfig, type PipelineExecutor } from './pipeline-executor'
export { getDefaultGroups, resolveGroupMembers, refreshBehavioralGroups, type ChannelGroupDef } from './channel-groups'
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/loop/index.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/loop/index.ts tests/services/loop/index.test.ts
git commit -m "feat(phase10): add loop service barrel export"
```

---

## Task 8: Wire Engagement Emitters

**Files:**
- Modify: `src/services/engagement/collector.ts`
- Modify: `src/services/engagement/optimizer-trigger.ts`
- Modify: `src/routes/webhooks/meta.ts`
- Test: `tests/services/loop/wire-engagement.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/loop/wire-engagement.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../../src/services/loop'
import { createEngagementWatcher } from '../../src/services/loop/watchers/engagement'

describe('Engagement → Event Bus wiring', () => {
	it('should emit engagement.threshold_reached when threshold met', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('engagement.threshold_reached', handler)

		const watcher = createEngagementWatcher(bus)
		await watcher.onEngagementCollected('tenant-1', {
			publishedContentId: 'pc-1',
			channel: 'email',
			score: 150,
			totalEvents: 200,
		})

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				type: 'engagement.threshold_reached',
			}),
		)
	})

	it('should NOT emit threshold event when below threshold', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('engagement.threshold_reached', handler)

		const watcher = createEngagementWatcher(bus)
		await watcher.onEngagementCollected('tenant-1', {
			publishedContentId: 'pc-1',
			channel: 'email',
			score: 30,
			totalEvents: 50,
		})

		expect(handler).not.toHaveBeenCalled()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/loop/wire-engagement.test.ts`
Expected: FAIL

**Step 3: Create engagement watcher**

```typescript
// src/services/loop/watchers/engagement.ts
import type { EventBus } from '../event-bus'
import { shouldTriggerOptimization } from '../../engagement/optimizer-trigger'

export interface EngagementData {
	publishedContentId: string
	channel: string
	score: number
	totalEvents: number
}

export function createEngagementWatcher(bus: EventBus) {
	return {
		async onEngagementCollected(tenantId: string, data: EngagementData) {
			await bus.emit(tenantId, 'engagement.collected', data)

			const trigger = shouldTriggerOptimization(data.totalEvents)
			if (trigger.triggered) {
				await bus.emit(tenantId, 'engagement.threshold_reached', {
					channel: data.channel,
					currentScore: data.score,
					totalEvents: data.totalEvents,
					threshold: trigger.threshold,
				})
			}
		},
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/loop/wire-engagement.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/loop/watchers/engagement.ts tests/services/loop/wire-engagement.test.ts
git commit -m "feat(phase10): wire engagement collection to event bus with threshold cascade"
```

---

## Task 9: Wire Sentiment + Delivery Emitters

**Files:**
- Create: `src/services/loop/watchers/sentiment.ts`
- Create: `src/services/loop/watchers/delivery.ts`
- Test: `tests/services/loop/wire-sentiment.test.ts`
- Test: `tests/services/loop/wire-delivery.test.ts`

**Step 1: Write tests**

```typescript
// tests/services/loop/wire-sentiment.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../../src/services/loop'
import { createSentimentWatcher } from '../../src/services/loop/watchers/sentiment'

describe('Sentiment → Event Bus wiring', () => {
	it('should emit sentiment.drift_detected when drift found', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('sentiment.drift_detected', handler)

		const watcher = createSentimentWatcher(bus)
		await watcher.onDriftDetected('tenant-1', {
			brand: 'TestBrand',
			direction: 'negative',
			zScore: 3.2,
			baselineMean: 0.6,
			currentMean: 0.2,
			themes: ['product issues', 'customer service'],
		})

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				payload: expect.objectContaining({ brand: 'TestBrand', direction: 'negative' }),
			}),
		)
	})
})
```

```typescript
// tests/services/loop/wire-delivery.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../../src/services/loop'
import { createDeliveryWatcher } from '../../src/services/loop/watchers/delivery'

describe('Delivery → Event Bus wiring', () => {
	it('should emit delivery.completed', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('delivery.completed', handler)

		const watcher = createDeliveryWatcher(bus)
		await watcher.onDeliveryCompleted('tenant-1', {
			campaignId: 'c-1',
			channel: 'email',
			metrics: { sent: 100, delivered: 95, opened: 40, clicked: 15 },
		})

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				payload: expect.objectContaining({ campaignId: 'c-1', channel: 'email' }),
			}),
		)
	})
})
```

**Step 2: Run tests to verify they fail**

Run: `bunx vitest run tests/services/loop/wire-sentiment.test.ts tests/services/loop/wire-delivery.test.ts`
Expected: FAIL

**Step 3: Write implementations**

```typescript
// src/services/loop/watchers/sentiment.ts
import type { EventBus } from '../event-bus'

export interface DriftData {
	brand: string
	direction: 'positive' | 'negative'
	zScore: number
	baselineMean: number
	currentMean: number
	themes: string[]
}

export function createSentimentWatcher(bus: EventBus) {
	return {
		async onDriftDetected(tenantId: string, data: DriftData) {
			await bus.emit(tenantId, 'sentiment.drift_detected', data)
		},
	}
}
```

```typescript
// src/services/loop/watchers/delivery.ts
import type { EventBus } from '../event-bus'

export interface DeliveryData {
	campaignId: string
	channel: string
	metrics: Record<string, number>
}

export function createDeliveryWatcher(bus: EventBus) {
	return {
		async onDeliveryCompleted(tenantId: string, data: DeliveryData) {
			await bus.emit(tenantId, 'delivery.completed', data)
		},
	}
}
```

**Step 4: Run tests to verify they pass**

Run: `bunx vitest run tests/services/loop/wire-sentiment.test.ts tests/services/loop/wire-delivery.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/loop/watchers/sentiment.ts src/services/loop/watchers/delivery.ts tests/services/loop/wire-sentiment.test.ts tests/services/loop/wire-delivery.test.ts
git commit -m "feat(phase10): wire sentiment drift and delivery completion to event bus"
```

---

## Task 10: Content Flywheel Pipeline Handler

**Files:**
- Create: `src/services/loop/pipelines/content-flywheel.ts`
- Test: `tests/services/loop/pipelines/content-flywheel.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/loop/pipelines/content-flywheel.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createContentFlywheelHandler } from '../../../src/services/loop/pipelines/content-flywheel'
import type { LoopEvent } from '../../../src/services/loop'

describe('Content Flywheel Pipeline', () => {
	const mockEvent: LoopEvent = {
		id: 'e-1',
		tenantId: 'tenant-1',
		type: 'engagement.threshold_reached',
		payload: { channel: 'email', currentScore: 85, threshold: 100 },
		timestamp: new Date(),
	}

	it('should call learning iteration with correct context', async () => {
		const mockLearning = vi.fn().mockResolvedValue({
			evaluation: { combinedScore: 0.8 },
			candidatePrompts: ['Evolved prompt v2'],
		})

		const handler = createContentFlywheelHandler({
			runLearning: mockLearning,
			getActivePrompt: vi.fn().mockResolvedValue({ id: 'pv-1', systemPrompt: 'sys', instruction: 'instr' }),
			storeCandidate: vi.fn().mockResolvedValue('pv-2'),
		})

		await handler(mockEvent, {})

		expect(mockLearning).toHaveBeenCalledWith(
			expect.objectContaining({ channel: 'email' }),
		)
	})

	it('should store candidate prompt with lineage', async () => {
		const storeCandidate = vi.fn().mockResolvedValue('pv-2')

		const handler = createContentFlywheelHandler({
			runLearning: vi.fn().mockResolvedValue({
				evaluation: { combinedScore: 0.8 },
				candidatePrompts: ['New system prompt'],
			}),
			getActivePrompt: vi.fn().mockResolvedValue({ id: 'pv-1', systemPrompt: 'sys', instruction: 'instr', version: 1 }),
			storeCandidate,
		})

		await handler(mockEvent, {})

		expect(storeCandidate).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				channel: 'email',
				parentId: 'pv-1',
			}),
		)
	})

	it('should respect strategy override from rules', async () => {
		const mockLearning = vi.fn().mockResolvedValue({
			evaluation: { combinedScore: 0.7 },
			candidatePrompts: ['prompt'],
		})

		const handler = createContentFlywheelHandler({
			runLearning: mockLearning,
			getActivePrompt: vi.fn().mockResolvedValue({ id: 'pv-1', systemPrompt: 'sys', instruction: 'instr' }),
			storeCandidate: vi.fn().mockResolvedValue('pv-2'),
		})

		await handler(mockEvent, { strategy: 'textgrad' })

		expect(mockLearning).toHaveBeenCalledWith(
			expect.objectContaining({ strategy: 'textgrad' }),
		)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/loop/pipelines/content-flywheel.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/services/loop/pipelines/content-flywheel.ts
import type { LoopEvent } from '../event-bus'

export interface ActivePrompt {
	id: string
	systemPrompt: string
	instruction: string
	version?: number
}

export interface CandidateInput {
	tenantId: string
	channel: string
	systemPrompt: string
	instruction: string
	parentId: string
	strategy: string
	qualityScore: number
}

export interface FlywheelDeps {
	runLearning: (context: { channel: string; strategy: string; currentPrompt: string }) => Promise<{
		evaluation: { combinedScore: number }
		candidatePrompts: string[]
	}>
	getActivePrompt: (tenantId: string, channel: string) => Promise<ActivePrompt | null>
	storeCandidate: (input: CandidateInput) => Promise<string>
}

export function createContentFlywheelHandler(deps: FlywheelDeps) {
	return async (event: LoopEvent, configOverrides: Record<string, unknown>) => {
		const channel = event.payload.channel as string
		const strategy = (configOverrides.strategy as string) ?? 'hybrid'

		const activePrompt = await deps.getActivePrompt(event.tenantId, channel)
		if (!activePrompt) return

		const result = await deps.runLearning({
			channel,
			strategy,
			currentPrompt: activePrompt.systemPrompt,
		})

		if (result.candidatePrompts.length === 0) return

		await deps.storeCandidate({
			tenantId: event.tenantId,
			channel,
			systemPrompt: result.candidatePrompts[0],
			instruction: activePrompt.instruction,
			parentId: activePrompt.id,
			strategy,
			qualityScore: result.evaluation.combinedScore,
		})
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/loop/pipelines/content-flywheel.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/loop/pipelines/content-flywheel.ts tests/services/loop/pipelines/content-flywheel.test.ts
git commit -m "feat(phase10): add content flywheel pipeline handler"
```

---

## Task 11: Strategic Reactor Pipeline Handler

**Files:**
- Create: `src/services/loop/pipelines/strategic-reactor.ts`
- Test: `tests/services/loop/pipelines/strategic-reactor.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/loop/pipelines/strategic-reactor.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createStrategicReactorHandler } from '../../../src/services/loop/pipelines/strategic-reactor'
import type { LoopEvent } from '../../../src/services/loop'

describe('Strategic Reactor Pipeline', () => {
	const driftEvent: LoopEvent = {
		id: 'e-1',
		tenantId: 'tenant-1',
		type: 'sentiment.drift_detected',
		payload: { brand: 'TestBrand', direction: 'negative', zScore: 3.0, themes: ['product issues'] },
		timestamp: new Date(),
	}

	it('should generate campaign brief from drift context', async () => {
		const generateContent = vi.fn().mockResolvedValue({ subject: 'Response' })

		const handler = createStrategicReactorHandler({
			generateContent,
			resolveChannels: vi.fn().mockReturnValue(['linkedin', 'instagram']),
		})

		await handler(driftEvent, {})

		expect(generateContent).toHaveBeenCalledWith(
			expect.objectContaining({
				goal: expect.stringContaining('TestBrand'),
				channels: ['linkedin', 'instagram'],
			}),
		)
	})

	it('should use empathetic tone for negative drift', async () => {
		const generateContent = vi.fn().mockResolvedValue({})

		const handler = createStrategicReactorHandler({
			generateContent,
			resolveChannels: vi.fn().mockReturnValue(['linkedin']),
		})

		await handler(driftEvent, {})

		expect(generateContent).toHaveBeenCalledWith(
			expect.objectContaining({ tone: 'empathetic' }),
		)
	})
})
```

**Step 2: Run test to verify it fails, write implementation, verify passes**

```typescript
// src/services/loop/pipelines/strategic-reactor.ts
import type { LoopEvent } from '../event-bus'

export interface ReactorDeps {
	generateContent: (brief: { goal: string; tone: string; keywords: string[]; channels: string[] }) => Promise<unknown>
	resolveChannels: (direction: string) => string[]
}

export function createStrategicReactorHandler(deps: ReactorDeps) {
	return async (event: LoopEvent, _configOverrides: Record<string, unknown>) => {
		const { brand, direction, themes } = event.payload as {
			brand: string; direction: string; themes: string[]
		}

		const tone = direction === 'negative' ? 'empathetic' : 'celebratory'
		const channels = deps.resolveChannels(direction)

		await deps.generateContent({
			goal: `Address ${direction} sentiment about ${brand}: ${(themes ?? []).join(', ')}`,
			tone,
			keywords: themes ?? [],
			channels,
		})
	}
}
```

**Step 3: Run test, commit**

Run: `bunx vitest run tests/services/loop/pipelines/strategic-reactor.test.ts`
Expected: PASS

```bash
git add src/services/loop/pipelines/strategic-reactor.ts tests/services/loop/pipelines/strategic-reactor.test.ts
git commit -m "feat(phase10): add strategic reactor pipeline for sentiment-driven campaigns"
```

---

## Task 12: Experiment Auto-Closer + Signal Feedback Pipelines

**Files:**
- Create: `src/services/loop/pipelines/experiment-closer.ts`
- Create: `src/services/loop/pipelines/signal-feedback.ts`
- Test: `tests/services/loop/pipelines/experiment-closer.test.ts`
- Test: `tests/services/loop/pipelines/signal-feedback.test.ts`

Follow the same TDD pattern as Tasks 10-11. Key behaviors:

**Experiment Auto-Closer:**
- On `engagement.collected`, look up content lineage for experiment arm linkage
- If linked to an arm, auto-reward based on score vs. median
- Check experiment convergence (> 95% Thompson confidence → declare winner)

**Signal Feedback:**
- On `delivery.completed`, look up target account
- Engaged → +10 score, Ignored → -2, Bounced → -15, Unsubscribed → -25
- Recalculate account level (hot/warm/cold)

**Step 1: Write tests for both pipelines**
**Step 2: Run to verify they fail**
**Step 3: Implement both**
**Step 4: Run to verify they pass**
**Step 5: Commit**

```bash
git add src/services/loop/pipelines/experiment-closer.ts src/services/loop/pipelines/signal-feedback.ts tests/services/loop/pipelines/experiment-closer.test.ts tests/services/loop/pipelines/signal-feedback.test.ts
git commit -m "feat(phase10): add experiment auto-closer and signal feedback pipelines"
```

---

## Task 13: Loop Routes — Pipelines + Rules + Groups CRUD

**Files:**
- Create: `src/routes/loops.ts`
- Modify: `src/routes/index.ts`
- Test: `tests/routes/loops.test.ts`

**Step 1: Write failing tests**

```typescript
// tests/routes/loops.test.ts
import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('loop routes', () => {
	const app = createApp()

	it('GET /api/v1/loops/pipelines should return pipelines', async () => {
		const res = await app.request('/api/v1/loops/pipelines')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.pipelines).toBeInstanceOf(Array)
	})

	it('GET /api/v1/loops/rules should return rules', async () => {
		const res = await app.request('/api/v1/loops/rules')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.rules).toBeInstanceOf(Array)
	})

	it('GET /api/v1/loops/groups should return channel groups', async () => {
		const res = await app.request('/api/v1/loops/groups')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.groups).toBeInstanceOf(Array)
	})

	it('GET /api/v1/loops/events should return event history', async () => {
		const res = await app.request('/api/v1/loops/events')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.events).toBeInstanceOf(Array)
	})

	it('GET /api/v1/loops/lineage/:channel should return prompt lineage', async () => {
		const res = await app.request('/api/v1/loops/lineage/email')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.versions).toBeInstanceOf(Array)
	})
})
```

**Step 2: Run to verify they fail**

**Step 3: Create routes**

```typescript
// src/routes/loops.ts
import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { getDefaultGroups } from '../services/loop/channel-groups'

export function createLoopRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/pipelines', async (c) => {
		// TODO: query loopPipelines by tenantId when DB wired
		return c.json({ pipelines: [] })
	})

	router.get('/rules', async (c) => {
		return c.json({ rules: [] })
	})

	router.get('/groups', (c) => {
		const groups = getDefaultGroups()
		return c.json({ groups })
	})

	router.get('/events', async (c) => {
		return c.json({ events: [] })
	})

	router.get('/lineage/:channel', async (c) => {
		return c.json({ versions: [] })
	})

	return router
}
```

**Step 4: Register route in `src/routes/index.ts`**

Add import:
```typescript
import { createLoopRoutes } from './loops'
```

Add registration:
```typescript
app.route('/api/v1/loops', createLoopRoutes())
```

**Step 5: Run tests, commit**

Run: `bunx vitest run tests/routes/loops.test.ts`
Expected: PASS

```bash
git add src/routes/loops.ts src/routes/index.ts tests/routes/loops.test.ts
git commit -m "feat(phase10): add loop routes for pipelines, rules, groups, events, lineage"
```

---

## Task 14: MCP Tools for AI Access

**Files:**
- Create: `src/mcp/tools/loops.ts`
- Modify: `src/mcp/server.ts` (register tools)
- Modify: `src/routes/mcp.ts` (add handlers)
- Test: `tests/mcp/tools/loops.test.ts`

**Step 1: Write failing test**

```typescript
// tests/mcp/tools/loops.test.ts
import { describe, it, expect } from 'vitest'
import { handleGetLoopStatus, handleGetLoopInsights, handleGetPromptLineage } from '../../src/mcp/tools/loops'

describe('Loop MCP tools', () => {
	it('getLoopStatus returns structured status', async () => {
		const result = await handleGetLoopStatus('tenant-1')
		expect(result).toHaveProperty('pipelines')
		expect(result).toHaveProperty('activeRules')
	})

	it('getPromptLineage returns versions array', async () => {
		const result = await handleGetPromptLineage('email', 'tenant-1')
		expect(result).toHaveProperty('channel')
		expect(result).toHaveProperty('versions')
	})

	it('getLoopInsights returns summary', async () => {
		const result = await handleGetLoopInsights(7, 'tenant-1')
		expect(result).toHaveProperty('period')
		expect(result).toHaveProperty('summary')
	})
})
```

**Step 2: Run to verify it fails**

**Step 3: Create MCP tool handlers**

```typescript
// src/mcp/tools/loops.ts
export async function handleGetLoopStatus(tenantId: string) {
	return {
		pipelines: [],
		activeRules: 0,
		recentEvents: 0,
		channelGroups: 0,
	}
}

export async function handleGetPromptLineage(channel: string, tenantId: string) {
	return {
		channel,
		versions: [],
	}
}

export async function handleGetLoopInsights(days: number, tenantId: string) {
	return {
		period: `${days} days`,
		summary: 'No loop activity yet.',
		optimizationCycles: 0,
		experimentsResolved: 0,
		driftEvents: 0,
		accountMoves: 0,
	}
}
```

**Step 4: Register tools in `src/mcp/server.ts` and `src/routes/mcp.ts`**

Add to MCP server's tool list: `get_loop_status`, `get_prompt_lineage`, `get_loop_insights`.

Add to `src/routes/mcp.ts` TOOL_DESCRIPTIONS and handlers maps.

**Step 5: Run tests, commit**

Run: `bunx vitest run tests/mcp/tools/loops.test.ts`
Expected: PASS

```bash
git add src/mcp/tools/loops.ts src/mcp/server.ts src/routes/mcp.ts tests/mcp/tools/loops.test.ts
git commit -m "feat(phase10): add MCP tools for loop status, lineage, and insights"
```

---

## Task 15: Integration Test — Full Loop Cycle

**Files:**
- Create: `tests/integration/phase10.test.ts`

**Step 1: Write integration test**

```typescript
// tests/integration/phase10.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createEventBus, createPipelineExecutor, evaluateRules, getDefaultGroups, refreshBehavioralGroups } from '../../src/services/loop'
import { createEngagementWatcher } from '../../src/services/loop/watchers/engagement'
import { createSentimentWatcher } from '../../src/services/loop/watchers/sentiment'
import { createContentFlywheelHandler } from '../../src/services/loop/pipelines/content-flywheel'

describe('Phase 10 integration: closed-loop intelligence', () => {
	it('should complete full engagement → optimization → prompt storage cycle', async () => {
		const bus = createEventBus()
		const storeCandidate = vi.fn().mockResolvedValue('pv-2')

		const flywheelHandler = createContentFlywheelHandler({
			runLearning: vi.fn().mockResolvedValue({
				evaluation: { combinedScore: 0.85 },
				candidatePrompts: ['Evolved email prompt v2'],
			}),
			getActivePrompt: vi.fn().mockResolvedValue({
				id: 'pv-1', systemPrompt: 'Original prompt', instruction: 'Write email', version: 1,
			}),
			storeCandidate,
		})

		const executor = createPipelineExecutor(bus)
		executor.register({
			name: 'content-flywheel',
			eventType: 'engagement.threshold_reached',
			action: flywheelHandler,
			getRules: async () => [],
			getContext: async () => ({}),
		})

		const watcher = createEngagementWatcher(bus)
		await watcher.onEngagementCollected('tenant-1', {
			publishedContentId: 'pc-1',
			channel: 'email',
			score: 85,
			totalEvents: 150,
		})

		expect(storeCandidate).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				channel: 'email',
				parentId: 'pv-1',
			}),
		)
	})

	it('should gate flywheel when rule blocks channel', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		executor.register({
			name: 'content-flywheel',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [{
				id: 'r1', name: 'block-email', priority: 1, cooldownMinutes: 0,
				conditions: [{ field: 'channel', op: 'eq' as const, value: 'email' }],
				actions: [{ type: 'gate' as const }],
				scope: {},
			}],
			getContext: async () => ({}),
		})

		const watcher = createEngagementWatcher(bus)
		await watcher.onEngagementCollected('tenant-1', {
			publishedContentId: 'pc-1',
			channel: 'email',
			score: 85,
			totalEvents: 150,
		})

		expect(action).not.toHaveBeenCalled()
	})

	it('should react to sentiment drift by triggering campaign generation', async () => {
		const bus = createEventBus()
		const generateContent = vi.fn().mockResolvedValue({})
		const executor = createPipelineExecutor(bus)

		const { createStrategicReactorHandler } = await import('../../src/services/loop/pipelines/strategic-reactor')
		const handler = createStrategicReactorHandler({
			generateContent,
			resolveChannels: () => ['linkedin', 'instagram'],
		})

		executor.register({
			name: 'strategic-reactor',
			eventType: 'sentiment.drift_detected',
			action: handler,
			getRules: async () => [],
			getContext: async () => ({}),
		})

		const watcher = createSentimentWatcher(bus)
		await watcher.onDriftDetected('tenant-1', {
			brand: 'TestBrand',
			direction: 'negative',
			zScore: 3.5,
			baselineMean: 0.6,
			currentMean: 0.1,
			themes: ['product quality'],
		})

		expect(generateContent).toHaveBeenCalledWith(
			expect.objectContaining({
				tone: 'empathetic',
				channels: ['linkedin', 'instagram'],
			}),
		)
	})

	it('should refresh behavioral channel groups from scores', () => {
		const scores = {
			email: 90, linkedin: 80, sms: 50, tiktok: 20,
			facebook: 60, instagram: 55, whatsapp: 45,
			voice: 35, youtube: 40, vimeo: 15, video: 10,
		}
		const groups = refreshBehavioralGroups(scores)
		expect(groups['high-performers']).toContain('email')
		expect(groups['underperformers']).toContain('video')
	})

	it('should support rule engine with channel groups', () => {
		const rules = [{
			id: 'r1', name: 'boost-underperformers', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'in_group' as const, value: 'underperformers' }],
			actions: [{ type: 'modify' as const, set: { strategy: 'textgrad' } }],
			scope: {},
		}]
		const context = { groups: { underperformers: ['tiktok', 'vimeo', 'video'] } }
		const result = evaluateRules(rules, { channel: 'tiktok' }, context)
		expect(result.configOverrides).toEqual({ strategy: 'textgrad' })
	})
})
```

**Step 2: Run test**

Run: `bunx vitest run tests/integration/phase10.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/phase10.test.ts
git commit -m "test(phase10): add integration test for full closed-loop intelligence cycle"
```

---

## Task 16: Full Test Suite Verification

**Step 1: Run all tests**

Run: `bunx vitest run`
Expected: All tests PASS

**Step 2: Verify no regressions**

Check that test count increased from baseline (446 from Phase 7) and no existing tests broke.

**Step 3: Final commit if any fixes needed**
