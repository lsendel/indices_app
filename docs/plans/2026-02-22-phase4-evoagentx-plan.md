# Phase 4 — EvoAgentX Intelligence Engine

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Port the EvoAgentX self-evolving campaign system to TypeScript — workflow generation, task planning, agent orchestration, TextGrad prompt optimization, evolutionary prompt improvement, campaign evaluation, and human-in-the-loop approval gates.

**Architecture:** LLM-powered DAG generation decomposes marketing goals into executable workflows. Agents auto-generate for each task node. Campaign results feed back through TextGrad (gradient-based prompt refinement) and EvoPrompt (GA/DE evolutionary optimization) to continuously improve prompt quality. HITL gates allow human approval at critical workflow steps.

**Tech Stack:** Hono 4.12, Drizzle ORM (NeonDB), Zod, Vitest, OpenAI adapter (existing `createOpenAIAdapter()`), existing Thompson Sampling / MAB infrastructure, existing ZelutoClient for campaign stats.

---

## File Map

```
src/types/
  workflow.ts          — DAG types (WorkFlowNode, WorkFlowEdge, WorkFlowGraph, Parameter)
  agents.ts            — Agent types (AgentConfig, TaskResult, AgentTask)

src/db/schema/
  workflows.ts         — workflows, workflow_nodes, workflow_edges tables
  agent-configs.ts     — agent_configs table
  prompt-versions.ts   — prompt_versions, prompt_gradients tables
  evolution-cycles.ts  — evolution_cycles, evolution_candidates tables
  hitl-requests.ts     — hitl_requests table

src/services/evo/
  workflow-graph.ts    — DAG utilities (inferEdges, getNextNodes, validate, topSort)
  task-planner.ts      — LLM goal decomposition into sub-tasks
  agent-generator.ts   — LLM agent config generation for each task
  workflow-gen.ts      — Orchestrator: goal → plan → graph → agents
  evaluator.ts         — Campaign scoring (metrics + LLM assessment)
  textgrad.ts          — LLM-based prompt gradient descent
  prompt-population.ts — GA/DE evolutionary prompt optimization
  optimizer.ts         — Orchestrate TextGrad + EvoPrompt cycles
  learning-loop.ts     — Full loop: signals → generate → execute → evaluate → evolve
  hitl.ts              — Human approval queue with timeout expiry

src/routes/
  workflows.ts         — CRUD + execution endpoints for workflows
  evolution.ts         — Prompt evolution + HITL endpoints

tests/
  (mirrors src structure)
```

---

### Task 1: Workflow & Agent Type Definitions

**Files:**
- Create: `src/types/workflow.ts`
- Create: `src/types/agents.ts`
- Test: `tests/types/workflow.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/types/workflow.test.ts
import { describe, it, expect } from 'vitest'
import type {
	Parameter,
	WorkFlowNode,
	WorkFlowEdge,
	WorkFlowGraph,
	NodeStatus,
} from '../../src/types/workflow'
import type {
	AgentConfig,
	AgentTask,
	TaskResult,
} from '../../src/types/agents'

describe('workflow types', () => {
	it('creates a valid Parameter', () => {
		const param: Parameter = { name: 'topic', description: 'Marketing topic', required: true }
		expect(param.name).toBe('topic')
		expect(param.required).toBe(true)
	})

	it('creates a valid WorkFlowNode', () => {
		const node: WorkFlowNode = {
			name: 'research',
			description: 'Research target market',
			inputs: [{ name: 'goal', description: 'Campaign goal', required: true }],
			outputs: [{ name: 'insights', description: 'Market insights', required: true }],
			status: 'pending',
			agentId: null,
		}
		expect(node.status).toBe('pending')
		expect(node.inputs).toHaveLength(1)
	})

	it('creates a valid WorkFlowEdge', () => {
		const edge: WorkFlowEdge = { source: 'research', target: 'draft', priority: 1 }
		expect(edge.source).toBe('research')
	})

	it('creates a valid WorkFlowGraph', () => {
		const graph: WorkFlowGraph = {
			goal: 'Launch email campaign',
			nodes: [],
			edges: [],
		}
		expect(graph.goal).toBe('Launch email campaign')
	})

	it('NodeStatus covers all valid states', () => {
		const statuses: NodeStatus[] = ['pending', 'running', 'completed', 'failed', 'awaiting_approval']
		expect(statuses).toHaveLength(5)
	})
})

describe('agent types', () => {
	it('creates a valid AgentConfig', () => {
		const config: AgentConfig = {
			name: 'researcher',
			description: 'Researches market data',
			systemPrompt: 'You are a market researcher.',
			instructionPrompt: 'Analyze the following market.',
			inputs: [{ name: 'market', description: 'Target market', required: true }],
			outputs: [{ name: 'report', description: 'Market report', required: true }],
		}
		expect(config.name).toBe('researcher')
	})

	it('creates a valid AgentTask', () => {
		const task: AgentTask = {
			nodeName: 'research',
			agentConfig: {
				name: 'researcher',
				description: 'Researches markets',
				systemPrompt: 'You are a researcher.',
				instructionPrompt: 'Research this.',
				inputs: [],
				outputs: [],
			},
			inputValues: { goal: 'Increase sign-ups' },
		}
		expect(task.nodeName).toBe('research')
	})

	it('creates a valid TaskResult', () => {
		const result: TaskResult = {
			nodeName: 'research',
			success: true,
			outputs: { report: 'Market analysis complete' },
			error: null,
		}
		expect(result.success).toBe(true)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/types/workflow.test.ts`
Expected: FAIL — modules not found

**Step 3: Write workflow types**

```typescript
// src/types/workflow.ts
export interface Parameter {
	name: string
	description: string
	required: boolean
}

export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'awaiting_approval'

export interface WorkFlowNode {
	name: string
	description: string
	inputs: Parameter[]
	outputs: Parameter[]
	status: NodeStatus
	agentId: string | null
}

export interface WorkFlowEdge {
	source: string
	target: string
	priority: number
}

export interface WorkFlowGraph {
	goal: string
	nodes: WorkFlowNode[]
	edges: WorkFlowEdge[]
}
```

```typescript
// src/types/agents.ts
import type { Parameter } from './workflow'

export interface AgentConfig {
	name: string
	description: string
	systemPrompt: string
	instructionPrompt: string
	inputs: Parameter[]
	outputs: Parameter[]
}

export interface AgentTask {
	nodeName: string
	agentConfig: AgentConfig
	inputValues: Record<string, string>
}

export interface TaskResult {
	nodeName: string
	success: boolean
	outputs: Record<string, string>
	error: string | null
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/types/workflow.test.ts`
Expected: PASS (all 7 tests)

**Step 5: Commit**

```bash
git add src/types/workflow.ts src/types/agents.ts tests/types/workflow.test.ts
git commit -m "feat(phase4): add workflow DAG and agent type definitions"
```

---

### Task 2: Database Schemas — Workflows, Agents, Prompts, Evolution, HITL

**Files:**
- Create: `src/db/schema/workflows.ts`
- Create: `src/db/schema/agent-configs.ts`
- Create: `src/db/schema/prompt-versions.ts`
- Create: `src/db/schema/evolution-cycles.ts`
- Create: `src/db/schema/hitl-requests.ts`
- Modify: `src/db/schema/index.ts` (add exports)
- Test: `tests/db/evo-schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/db/evo-schema.test.ts
import { describe, it, expect } from 'vitest'
import {
	workflows,
	workflowNodes,
	workflowEdges,
} from '../../src/db/schema/workflows'
import { agentConfigs } from '../../src/db/schema/agent-configs'
import { promptVersions, promptGradients } from '../../src/db/schema/prompt-versions'
import { evolutionCycles, evolutionCandidates } from '../../src/db/schema/evolution-cycles'
import { hitlRequests } from '../../src/db/schema/hitl-requests'

describe('evo schemas', () => {
	it('workflows table has required columns', () => {
		expect(workflows.id).toBeDefined()
		expect(workflows.tenantId).toBeDefined()
		expect(workflows.goal).toBeDefined()
		expect(workflows.status).toBeDefined()
	})

	it('workflowNodes table has required columns', () => {
		expect(workflowNodes.id).toBeDefined()
		expect(workflowNodes.workflowId).toBeDefined()
		expect(workflowNodes.name).toBeDefined()
		expect(workflowNodes.status).toBeDefined()
		expect(workflowNodes.inputs).toBeDefined()
		expect(workflowNodes.outputs).toBeDefined()
	})

	it('workflowEdges table has required columns', () => {
		expect(workflowEdges.sourceNodeId).toBeDefined()
		expect(workflowEdges.targetNodeId).toBeDefined()
		expect(workflowEdges.priority).toBeDefined()
	})

	it('agentConfigs table has required columns', () => {
		expect(agentConfigs.id).toBeDefined()
		expect(agentConfigs.tenantId).toBeDefined()
		expect(agentConfigs.name).toBeDefined()
		expect(agentConfigs.systemPrompt).toBeDefined()
		expect(agentConfigs.instructionPrompt).toBeDefined()
	})

	it('promptVersions table has required columns', () => {
		expect(promptVersions.id).toBeDefined()
		expect(promptVersions.agentConfigId).toBeDefined()
		expect(promptVersions.version).toBeDefined()
		expect(promptVersions.systemPrompt).toBeDefined()
		expect(promptVersions.score).toBeDefined()
	})

	it('promptGradients table has required columns', () => {
		expect(promptGradients.id).toBeDefined()
		expect(promptGradients.promptVersionId).toBeDefined()
		expect(promptGradients.gradient).toBeDefined()
		expect(promptGradients.loss).toBeDefined()
	})

	it('evolutionCycles table has required columns', () => {
		expect(evolutionCycles.id).toBeDefined()
		expect(evolutionCycles.tenantId).toBeDefined()
		expect(evolutionCycles.generation).toBeDefined()
		expect(evolutionCycles.strategy).toBeDefined()
		expect(evolutionCycles.status).toBeDefined()
	})

	it('evolutionCandidates table has required columns', () => {
		expect(evolutionCandidates.id).toBeDefined()
		expect(evolutionCandidates.cycleId).toBeDefined()
		expect(evolutionCandidates.prompt).toBeDefined()
		expect(evolutionCandidates.score).toBeDefined()
	})

	it('hitlRequests table has required columns', () => {
		expect(hitlRequests.id).toBeDefined()
		expect(hitlRequests.tenantId).toBeDefined()
		expect(hitlRequests.workflowId).toBeDefined()
		expect(hitlRequests.nodeId).toBeDefined()
		expect(hitlRequests.decision).toBeDefined()
		expect(hitlRequests.expiresAt).toBeDefined()
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/db/evo-schema.test.ts`
Expected: FAIL — modules not found

**Step 3: Write the schemas**

```typescript
// src/db/schema/workflows.ts
import { pgTable, text, timestamp, uuid, jsonb, integer, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const workflows = pgTable('workflows', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	goal: text('goal').notNull(),
	status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'paused'] }).default('pending').notNull(),
	campaignId: uuid('campaign_id'),
	metadata: jsonb('metadata').default({}).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_workflows_tenant').on(table.tenantId),
	index('idx_workflows_status').on(table.status),
])

export const workflowNodes = pgTable('workflow_nodes', {
	id: uuid('id').defaultRandom().primaryKey(),
	workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description').notNull(),
	status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'awaiting_approval'] }).default('pending').notNull(),
	agentConfigId: uuid('agent_config_id'),
	inputs: jsonb('inputs').default([]).notNull(),
	outputs: jsonb('outputs').default([]).notNull(),
	inputValues: jsonb('input_values').default({}).notNull(),
	outputValues: jsonb('output_values').default({}).notNull(),
	executionOrder: integer('execution_order').default(0).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_workflow_nodes_workflow').on(table.workflowId),
	index('idx_workflow_nodes_status').on(table.status),
])

export const workflowEdges = pgTable('workflow_edges', {
	id: uuid('id').defaultRandom().primaryKey(),
	workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
	sourceNodeId: uuid('source_node_id').notNull().references(() => workflowNodes.id, { onDelete: 'cascade' }),
	targetNodeId: uuid('target_node_id').notNull().references(() => workflowNodes.id, { onDelete: 'cascade' }),
	priority: integer('priority').default(0).notNull(),
}, (table) => [
	index('idx_workflow_edges_workflow').on(table.workflowId),
])
```

```typescript
// src/db/schema/agent-configs.ts
import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const agentConfigs = pgTable('agent_configs', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description').notNull(),
	systemPrompt: text('system_prompt').notNull(),
	instructionPrompt: text('instruction_prompt').notNull(),
	inputs: jsonb('inputs').default([]).notNull(),
	outputs: jsonb('outputs').default([]).notNull(),
	metadata: jsonb('metadata').default({}).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_agent_configs_tenant').on(table.tenantId),
])
```

```typescript
// src/db/schema/prompt-versions.ts
import { pgTable, text, timestamp, uuid, integer, real, index } from 'drizzle-orm/pg-core'
import { agentConfigs } from './agent-configs'

export const promptVersions = pgTable('prompt_versions', {
	id: uuid('id').defaultRandom().primaryKey(),
	agentConfigId: uuid('agent_config_id').notNull().references(() => agentConfigs.id, { onDelete: 'cascade' }),
	version: integer('version').notNull(),
	systemPrompt: text('system_prompt').notNull(),
	instructionPrompt: text('instruction_prompt').notNull(),
	score: real('score'),
	isActive: text('is_active', { enum: ['true', 'false'] }).default('false').notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_prompt_versions_agent').on(table.agentConfigId),
	index('idx_prompt_versions_version').on(table.agentConfigId, table.version),
])

export const promptGradients = pgTable('prompt_gradients', {
	id: uuid('id').defaultRandom().primaryKey(),
	promptVersionId: uuid('prompt_version_id').notNull().references(() => promptVersions.id, { onDelete: 'cascade' }),
	gradient: text('gradient').notNull(),
	loss: real('loss').notNull(),
	improvementSuggestion: text('improvement_suggestion'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_prompt_gradients_version').on(table.promptVersionId),
])
```

```typescript
// src/db/schema/evolution-cycles.ts
import { pgTable, text, timestamp, uuid, integer, real, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'

export const evolutionCycles = pgTable('evolution_cycles', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	agentConfigId: uuid('agent_config_id'),
	generation: integer('generation').notNull(),
	strategy: text('strategy', { enum: ['textgrad', 'ga', 'de', 'hybrid'] }).notNull(),
	status: text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).default('pending').notNull(),
	bestScore: real('best_score'),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => [
	index('idx_evolution_cycles_tenant').on(table.tenantId),
	index('idx_evolution_cycles_status').on(table.status),
])

export const evolutionCandidates = pgTable('evolution_candidates', {
	id: uuid('id').defaultRandom().primaryKey(),
	cycleId: uuid('cycle_id').notNull().references(() => evolutionCycles.id, { onDelete: 'cascade' }),
	prompt: text('prompt').notNull(),
	score: real('score'),
	parentIds: text('parent_ids'),
	mutationStrategy: text('mutation_strategy', { enum: ['crossover', 'mutation', 'de_mutation', 'textgrad'] }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_evolution_candidates_cycle').on(table.cycleId),
])
```

```typescript
// src/db/schema/hitl-requests.ts
import { pgTable, text, timestamp, uuid, jsonb, index } from 'drizzle-orm/pg-core'
import { tenants } from './tenants'
import { workflows, workflowNodes } from './workflows'

export const hitlRequests = pgTable('hitl_requests', {
	id: uuid('id').defaultRandom().primaryKey(),
	tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
	workflowId: uuid('workflow_id').notNull().references(() => workflows.id, { onDelete: 'cascade' }),
	nodeId: uuid('node_id').notNull().references(() => workflowNodes.id, { onDelete: 'cascade' }),
	decision: text('decision', { enum: ['pending', 'approved', 'rejected', 'modified'] }).default('pending').notNull(),
	context: jsonb('context').default({}).notNull(),
	modifications: jsonb('modifications'),
	decidedBy: uuid('decided_by'),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	decidedAt: timestamp('decided_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index('idx_hitl_requests_tenant').on(table.tenantId),
	index('idx_hitl_requests_workflow').on(table.workflowId),
	index('idx_hitl_requests_decision').on(table.decision),
])
```

**Step 4: Update schema index**

```typescript
// src/db/schema/index.ts — append these exports:
export * from './workflows'
export * from './agent-configs'
export * from './prompt-versions'
export * from './evolution-cycles'
export * from './hitl-requests'
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/db/evo-schema.test.ts`
Expected: PASS (9 tests)

**Step 6: Generate migration**

Run: `bunx drizzle-kit generate`
Expected: Migration file created in `src/db/migrations/`

**Step 7: Commit**

```bash
git add src/db/schema/workflows.ts src/db/schema/agent-configs.ts \
  src/db/schema/prompt-versions.ts src/db/schema/evolution-cycles.ts \
  src/db/schema/hitl-requests.ts src/db/schema/index.ts \
  tests/db/evo-schema.test.ts src/db/migrations/
git commit -m "feat(phase4): add workflow, agent, prompt, evolution, HITL schemas"
```

---

### Task 3: Zod Validation Schemas for Phase 4 API

**Files:**
- Modify: `src/types/api.ts` (append new schemas)
- Test: `tests/types/evo-api.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/types/evo-api.test.ts
import { describe, it, expect } from 'vitest'
import {
	workflowCreate,
	hitlDecision,
	evolutionStart,
	promptVersionCreate,
} from '../../src/types/api'

describe('evo API schemas', () => {
	it('validates workflowCreate', () => {
		const valid = workflowCreate.safeParse({ goal: 'Launch product email campaign' })
		expect(valid.success).toBe(true)
	})

	it('rejects empty goal', () => {
		const invalid = workflowCreate.safeParse({ goal: '' })
		expect(invalid.success).toBe(false)
	})

	it('validates hitlDecision', () => {
		const valid = hitlDecision.safeParse({
			decision: 'approved',
		})
		expect(valid.success).toBe(true)
	})

	it('validates hitlDecision with modifications', () => {
		const valid = hitlDecision.safeParse({
			decision: 'modified',
			modifications: { systemPrompt: 'Updated prompt' },
		})
		expect(valid.success).toBe(true)
	})

	it('rejects invalid hitl decision value', () => {
		const invalid = hitlDecision.safeParse({ decision: 'maybe' })
		expect(invalid.success).toBe(false)
	})

	it('validates evolutionStart', () => {
		const valid = evolutionStart.safeParse({
			agentConfigId: '550e8400-e29b-41d4-a716-446655440000',
			strategy: 'ga',
			populationSize: 5,
		})
		expect(valid.success).toBe(true)
	})

	it('defaults strategy to hybrid', () => {
		const valid = evolutionStart.safeParse({
			agentConfigId: '550e8400-e29b-41d4-a716-446655440000',
		})
		expect(valid.success).toBe(true)
		expect(valid.data?.strategy).toBe('hybrid')
	})

	it('validates promptVersionCreate', () => {
		const valid = promptVersionCreate.safeParse({
			agentConfigId: '550e8400-e29b-41d4-a716-446655440000',
			systemPrompt: 'You are a marketer.',
			instructionPrompt: 'Write a campaign email.',
		})
		expect(valid.success).toBe(true)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/types/evo-api.test.ts`
Expected: FAIL — schemas not found

**Step 3: Append schemas to api.ts**

Append the following to `src/types/api.ts`:

```typescript
// Workflows (Phase 4)
export const workflowCreate = z.object({
	goal: z.string().min(1).max(500),
	campaignId: z.string().uuid().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
})

export type WorkflowCreate = z.infer<typeof workflowCreate>

// HITL
export const hitlDecision = z.object({
	decision: z.enum(['approved', 'rejected', 'modified']),
	modifications: z.record(z.string(), z.any()).optional(),
})

export type HitlDecision = z.infer<typeof hitlDecision>

// Evolution
export const evolutionStart = z.object({
	agentConfigId: z.string().uuid(),
	strategy: z.enum(['textgrad', 'ga', 'de', 'hybrid']).default('hybrid'),
	populationSize: z.number().int().min(2).max(20).default(5),
	generations: z.number().int().min(1).max(50).default(10),
})

export type EvolutionStart = z.infer<typeof evolutionStart>

// Prompt versions
export const promptVersionCreate = z.object({
	agentConfigId: z.string().uuid(),
	systemPrompt: z.string().min(1),
	instructionPrompt: z.string().min(1),
})

export type PromptVersionCreate = z.infer<typeof promptVersionCreate>
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/types/evo-api.test.ts`
Expected: PASS (8 tests)

**Step 5: Commit**

```bash
git add src/types/api.ts tests/types/evo-api.test.ts
git commit -m "feat(phase4): add Zod schemas for workflow, HITL, evolution APIs"
```

---

### Task 4: Workflow Graph Utilities

**Files:**
- Create: `src/services/evo/workflow-graph.ts`
- Test: `tests/services/evo/workflow-graph.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/workflow-graph.test.ts
import { describe, it, expect } from 'vitest'
import { inferEdges, getNextNodes, validateGraph, topologicalSort } from '../../../src/services/evo/workflow-graph'
import type { WorkFlowNode, WorkFlowEdge } from '../../../src/types/workflow'

const makeNode = (name: string, inputs: string[], outputs: string[], status = 'pending' as const): WorkFlowNode => ({
	name,
	description: `${name} task`,
	inputs: inputs.map(n => ({ name: n, description: n, required: true })),
	outputs: outputs.map(n => ({ name: n, description: n, required: true })),
	status,
	agentId: null,
})

describe('inferEdges', () => {
	it('infers edges from matching output→input parameter names', () => {
		const nodes = [
			makeNode('research', [], ['insights']),
			makeNode('draft', ['insights'], ['email_body']),
			makeNode('review', ['email_body'], ['approved_body']),
		]
		const edges = inferEdges(nodes)
		expect(edges).toHaveLength(2)
		expect(edges[0]).toEqual({ source: 'research', target: 'draft', priority: 0 })
		expect(edges[1]).toEqual({ source: 'draft', target: 'review', priority: 0 })
	})

	it('returns empty edges when no parameters match', () => {
		const nodes = [
			makeNode('a', [], ['x']),
			makeNode('b', ['y'], []),
		]
		expect(inferEdges(nodes)).toHaveLength(0)
	})

	it('handles multi-input nodes', () => {
		const nodes = [
			makeNode('research', [], ['insights']),
			makeNode('persona', [], ['tone']),
			makeNode('draft', ['insights', 'tone'], ['email_body']),
		]
		const edges = inferEdges(nodes)
		expect(edges).toHaveLength(2)
	})
})

describe('getNextNodes', () => {
	it('returns nodes with all predecessors completed', () => {
		const nodes = [
			makeNode('a', [], ['x'], 'completed'),
			makeNode('b', ['x'], ['y'], 'pending'),
			makeNode('c', ['y'], [], 'pending'),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
			{ source: 'b', target: 'c', priority: 0 },
		]
		const next = getNextNodes(nodes, edges)
		expect(next.map(n => n.name)).toEqual(['b'])
	})

	it('returns root nodes when nothing is completed', () => {
		const nodes = [
			makeNode('a', [], ['x']),
			makeNode('b', ['x'], []),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
		]
		const next = getNextNodes(nodes, edges)
		expect(next.map(n => n.name)).toEqual(['a'])
	})

	it('returns multiple ready nodes for parallel execution', () => {
		const nodes = [
			makeNode('root', [], ['x'], 'completed'),
			makeNode('a', ['x'], [], 'pending'),
			makeNode('b', ['x'], [], 'pending'),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'root', target: 'a', priority: 0 },
			{ source: 'root', target: 'b', priority: 0 },
		]
		const next = getNextNodes(nodes, edges)
		expect(next).toHaveLength(2)
	})

	it('skips nodes that are already running or completed', () => {
		const nodes = [
			makeNode('a', [], ['x'], 'completed'),
			makeNode('b', ['x'], [], 'running'),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
		]
		expect(getNextNodes(nodes, edges)).toHaveLength(0)
	})
})

describe('validateGraph', () => {
	it('detects cycles', () => {
		const nodes = [
			makeNode('a', ['y'], ['x']),
			makeNode('b', ['x'], ['y']),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
			{ source: 'b', target: 'a', priority: 0 },
		]
		const result = validateGraph(nodes, edges)
		expect(result.valid).toBe(false)
		expect(result.error).toContain('cycle')
	})

	it('passes for a valid DAG', () => {
		const nodes = [
			makeNode('a', [], ['x']),
			makeNode('b', ['x'], ['y']),
			makeNode('c', ['y'], []),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
			{ source: 'b', target: 'c', priority: 0 },
		]
		expect(validateGraph(nodes, edges).valid).toBe(true)
	})

	it('detects references to non-existent nodes in edges', () => {
		const nodes = [makeNode('a', [], ['x'])]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'ghost', priority: 0 },
		]
		const result = validateGraph(nodes, edges)
		expect(result.valid).toBe(false)
		expect(result.error).toContain('ghost')
	})
})

describe('topologicalSort', () => {
	it('returns nodes in dependency order', () => {
		const nodes = [
			makeNode('c', ['y'], []),
			makeNode('a', [], ['x']),
			makeNode('b', ['x'], ['y']),
		]
		const edges: WorkFlowEdge[] = [
			{ source: 'a', target: 'b', priority: 0 },
			{ source: 'b', target: 'c', priority: 0 },
		]
		const sorted = topologicalSort(nodes, edges)
		expect(sorted.map(n => n.name)).toEqual(['a', 'b', 'c'])
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/workflow-graph.test.ts`
Expected: FAIL — module not found

**Step 3: Implement workflow-graph.ts**

```typescript
// src/services/evo/workflow-graph.ts
import type { WorkFlowNode, WorkFlowEdge } from '../../types/workflow'

/** Infer edges by matching output parameter names to input parameter names across nodes. */
export function inferEdges(nodes: WorkFlowNode[]): WorkFlowEdge[] {
	const edges: WorkFlowEdge[] = []

	for (const source of nodes) {
		const outputNames = new Set(source.outputs.map(o => o.name))
		for (const target of nodes) {
			if (source.name === target.name) continue
			const hasMatch = target.inputs.some(i => outputNames.has(i.name))
			if (hasMatch) {
				edges.push({ source: source.name, target: target.name, priority: 0 })
			}
		}
	}

	return edges
}

/** Find pending nodes whose ALL predecessor nodes are completed. */
export function getNextNodes(nodes: WorkFlowNode[], edges: WorkFlowEdge[]): WorkFlowNode[] {
	const nodeMap = new Map(nodes.map(n => [n.name, n]))
	const incoming = new Map<string, string[]>()

	for (const node of nodes) {
		incoming.set(node.name, [])
	}
	for (const edge of edges) {
		incoming.get(edge.target)?.push(edge.source)
	}

	return nodes.filter(node => {
		if (node.status !== 'pending') return false
		const predecessors = incoming.get(node.name) ?? []
		return predecessors.every(pred => {
			const predNode = nodeMap.get(pred)
			return predNode?.status === 'completed'
		})
	})
}

/** Validate that the graph is a DAG (no cycles) and all edge references exist. */
export function validateGraph(
	nodes: WorkFlowNode[],
	edges: WorkFlowEdge[],
): { valid: boolean; error?: string } {
	const nodeNames = new Set(nodes.map(n => n.name))

	for (const edge of edges) {
		if (!nodeNames.has(edge.source)) {
			return { valid: false, error: `Edge references non-existent node: ${edge.source}` }
		}
		if (!nodeNames.has(edge.target)) {
			return { valid: false, error: `Edge references non-existent node: ${edge.target}` }
		}
	}

	// Kahn's algorithm for cycle detection
	const inDegree = new Map<string, number>()
	const adjacency = new Map<string, string[]>()

	for (const name of nodeNames) {
		inDegree.set(name, 0)
		adjacency.set(name, [])
	}
	for (const edge of edges) {
		adjacency.get(edge.source)!.push(edge.target)
		inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
	}

	const queue = [...nodeNames].filter(n => inDegree.get(n) === 0)
	let visited = 0

	while (queue.length > 0) {
		const current = queue.shift()!
		visited++
		for (const neighbor of adjacency.get(current) ?? []) {
			const deg = inDegree.get(neighbor)! - 1
			inDegree.set(neighbor, deg)
			if (deg === 0) queue.push(neighbor)
		}
	}

	if (visited !== nodeNames.size) {
		return { valid: false, error: 'Graph contains a cycle' }
	}

	return { valid: true }
}

/** Return nodes in topological order (dependency-first). */
export function topologicalSort(nodes: WorkFlowNode[], edges: WorkFlowEdge[]): WorkFlowNode[] {
	const nodeMap = new Map(nodes.map(n => [n.name, n]))
	const inDegree = new Map<string, number>()
	const adjacency = new Map<string, string[]>()

	for (const node of nodes) {
		inDegree.set(node.name, 0)
		adjacency.set(node.name, [])
	}
	for (const edge of edges) {
		adjacency.get(edge.source)!.push(edge.target)
		inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
	}

	const queue = nodes.filter(n => inDegree.get(n.name) === 0).map(n => n.name)
	const result: WorkFlowNode[] = []

	while (queue.length > 0) {
		const current = queue.shift()!
		result.push(nodeMap.get(current)!)
		for (const neighbor of adjacency.get(current) ?? []) {
			const deg = inDegree.get(neighbor)! - 1
			inDegree.set(neighbor, deg)
			if (deg === 0) queue.push(neighbor)
		}
	}

	return result
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/workflow-graph.test.ts`
Expected: PASS (all 10 tests)

**Step 5: Commit**

```bash
git add src/services/evo/workflow-graph.ts tests/services/evo/workflow-graph.test.ts
git commit -m "feat(phase4): add DAG utilities — inferEdges, getNextNodes, validate, topSort"
```

---

### Task 5: Task Planner Service

**Files:**
- Create: `src/services/evo/task-planner.ts`
- Test: `tests/services/evo/task-planner.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/task-planner.test.ts
import { describe, it, expect, vi } from 'vitest'
import { decomposeGoal } from '../../../src/services/evo/task-planner'
import type { OpenAIAdapter } from '../../../src/adapters/openai'
import type { WorkFlowNode } from '../../../src/types/workflow'

function mockAdapter(response: string): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn().mockResolvedValue(response),
	}
}

describe('decomposeGoal', () => {
	it('decomposes a goal into workflow nodes via LLM', async () => {
		const llmResponse = JSON.stringify([
			{
				name: 'research_audience',
				description: 'Identify target audience segments',
				inputs: [{ name: 'goal', description: 'Campaign goal', required: true }],
				outputs: [{ name: 'audience_profile', description: 'Target audience data', required: true }],
			},
			{
				name: 'draft_content',
				description: 'Write email content for the audience',
				inputs: [{ name: 'audience_profile', description: 'Target audience data', required: true }],
				outputs: [{ name: 'email_body', description: 'Draft email HTML', required: true }],
			},
		])
		const adapter = mockAdapter(llmResponse)

		const nodes = await decomposeGoal(adapter, 'Launch product email campaign')
		expect(nodes).toHaveLength(2)
		expect(nodes[0].name).toBe('research_audience')
		expect(nodes[0].status).toBe('pending')
		expect(nodes[0].agentId).toBeNull()
		expect(nodes[1].inputs[0].name).toBe('audience_profile')
	})

	it('passes goal to generateContent with correct system prompt', async () => {
		const adapter = mockAdapter('[]')
		await decomposeGoal(adapter, 'My goal')

		expect(adapter.generateContent).toHaveBeenCalledWith(
			expect.stringContaining('My goal'),
			expect.stringContaining('task planner'),
		)
	})

	it('returns empty array for invalid LLM response', async () => {
		const adapter = mockAdapter('not valid json')
		const nodes = await decomposeGoal(adapter, 'Some goal')
		expect(nodes).toEqual([])
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/task-planner.test.ts`
Expected: FAIL — module not found

**Step 3: Implement task-planner.ts**

```typescript
// src/services/evo/task-planner.ts
import type { OpenAIAdapter } from '../../adapters/openai'
import type { WorkFlowNode } from '../../types/workflow'

const SYSTEM_PROMPT = `You are a marketing task planner. Decompose a marketing goal into a sequence of concrete sub-tasks. Return JSON array:
[{ "name": "snake_case_name", "description": "what this task does", "inputs": [{ "name": "param", "description": "desc", "required": true }], "outputs": [{ "name": "param", "description": "desc", "required": true }] }]
Name outputs so downstream tasks can reference them as inputs (matching names create edges).
Return ONLY the JSON array, no markdown.`

interface RawTask {
	name: string
	description: string
	inputs: { name: string; description: string; required: boolean }[]
	outputs: { name: string; description: string; required: boolean }[]
}

export async function decomposeGoal(
	adapter: OpenAIAdapter,
	goal: string,
): Promise<WorkFlowNode[]> {
	const response = await adapter.generateContent(
		`Decompose this marketing goal into sub-tasks:\n\n${goal}`,
		SYSTEM_PROMPT,
	)

	try {
		const tasks: RawTask[] = JSON.parse(response)
		if (!Array.isArray(tasks)) return []

		return tasks.map(task => ({
			name: task.name,
			description: task.description,
			inputs: task.inputs ?? [],
			outputs: task.outputs ?? [],
			status: 'pending' as const,
			agentId: null,
		}))
	} catch {
		return []
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/task-planner.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/services/evo/task-planner.ts tests/services/evo/task-planner.test.ts
git commit -m "feat(phase4): add task planner — LLM goal decomposition into workflow nodes"
```

---

### Task 6: Agent Generator Service

**Files:**
- Create: `src/services/evo/agent-generator.ts`
- Test: `tests/services/evo/agent-generator.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/agent-generator.test.ts
import { describe, it, expect, vi } from 'vitest'
import { generateAgentConfig } from '../../../src/services/evo/agent-generator'
import type { OpenAIAdapter } from '../../../src/adapters/openai'
import type { WorkFlowNode } from '../../../src/types/workflow'

function mockAdapter(response: string): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn().mockResolvedValue(response),
	}
}

const testNode: WorkFlowNode = {
	name: 'draft_email',
	description: 'Write a marketing email for the target audience',
	inputs: [{ name: 'audience_profile', description: 'Target audience', required: true }],
	outputs: [{ name: 'email_body', description: 'Email HTML', required: true }],
	status: 'pending',
	agentId: null,
}

describe('generateAgentConfig', () => {
	it('generates an agent config for a workflow node via LLM', async () => {
		const llmResponse = JSON.stringify({
			name: 'email_drafter',
			description: 'Drafts marketing emails tailored to audience segments',
			systemPrompt: 'You are an expert email copywriter.',
			instructionPrompt: 'Write a compelling marketing email based on the audience profile.',
		})
		const adapter = mockAdapter(llmResponse)

		const config = await generateAgentConfig(adapter, testNode)
		expect(config.name).toBe('email_drafter')
		expect(config.systemPrompt).toContain('copywriter')
		expect(config.inputs).toEqual(testNode.inputs)
		expect(config.outputs).toEqual(testNode.outputs)
	})

	it('falls back to node-derived config on invalid LLM response', async () => {
		const adapter = mockAdapter('garbage')
		const config = await generateAgentConfig(adapter, testNode)
		expect(config.name).toBe('draft_email')
		expect(config.systemPrompt).toContain('draft_email')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/agent-generator.test.ts`
Expected: FAIL — module not found

**Step 3: Implement agent-generator.ts**

```typescript
// src/services/evo/agent-generator.ts
import type { OpenAIAdapter } from '../../adapters/openai'
import type { WorkFlowNode } from '../../types/workflow'
import type { AgentConfig } from '../../types/agents'

const SYSTEM_PROMPT = `You generate AI agent configurations for marketing workflow tasks. Given a task description, return JSON:
{ "name": "agent_name", "description": "what this agent does", "systemPrompt": "system prompt for the agent", "instructionPrompt": "instruction prompt template" }
Return ONLY the JSON object, no markdown.`

export async function generateAgentConfig(
	adapter: OpenAIAdapter,
	node: WorkFlowNode,
): Promise<AgentConfig> {
	const prompt = `Generate an agent config for this task:
Name: ${node.name}
Description: ${node.description}
Inputs: ${node.inputs.map(i => i.name).join(', ')}
Outputs: ${node.outputs.map(o => o.name).join(', ')}`

	const response = await adapter.generateContent(prompt, SYSTEM_PROMPT)

	try {
		const parsed = JSON.parse(response) as {
			name: string
			description: string
			systemPrompt: string
			instructionPrompt: string
		}

		return {
			name: parsed.name,
			description: parsed.description,
			systemPrompt: parsed.systemPrompt,
			instructionPrompt: parsed.instructionPrompt,
			inputs: node.inputs,
			outputs: node.outputs,
		}
	} catch {
		return {
			name: node.name,
			description: node.description,
			systemPrompt: `You are an AI agent specialized in: ${node.name}. ${node.description}`,
			instructionPrompt: `Complete the following task: ${node.description}`,
			inputs: node.inputs,
			outputs: node.outputs,
		}
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/agent-generator.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/services/evo/agent-generator.ts tests/services/evo/agent-generator.test.ts
git commit -m "feat(phase4): add agent generator — LLM-based agent config creation"
```

---

### Task 7: Workflow Generator (Orchestrator)

**Files:**
- Create: `src/services/evo/workflow-gen.ts`
- Test: `tests/services/evo/workflow-gen.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/workflow-gen.test.ts
import { describe, it, expect, vi } from 'vitest'
import { generateWorkflow } from '../../../src/services/evo/workflow-gen'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(): OpenAIAdapter {
	const callCount = { n: 0 }
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn().mockImplementation(() => {
			callCount.n++
			if (callCount.n === 1) {
				// Task planner response
				return Promise.resolve(JSON.stringify([
					{
						name: 'research',
						description: 'Research target market',
						inputs: [{ name: 'goal', description: 'Goal', required: true }],
						outputs: [{ name: 'insights', description: 'Insights', required: true }],
					},
					{
						name: 'draft',
						description: 'Draft email content',
						inputs: [{ name: 'insights', description: 'Insights', required: true }],
						outputs: [{ name: 'email_body', description: 'Email', required: true }],
					},
				]))
			}
			// Agent generator responses
			return Promise.resolve(JSON.stringify({
				name: `agent_${callCount.n}`,
				description: 'Generated agent',
				systemPrompt: 'You are an agent.',
				instructionPrompt: 'Do the task.',
			}))
		}),
	}
}

describe('generateWorkflow', () => {
	it('generates a complete workflow from a goal', async () => {
		const adapter = mockAdapter()
		const workflow = await generateWorkflow(adapter, 'Launch product campaign')

		expect(workflow.goal).toBe('Launch product campaign')
		expect(workflow.graph.nodes).toHaveLength(2)
		expect(workflow.graph.edges).toHaveLength(1)
		expect(workflow.graph.edges[0].source).toBe('research')
		expect(workflow.graph.edges[0].target).toBe('draft')
		expect(workflow.agents).toHaveLength(2)
	})

	it('validates the generated graph is a DAG', async () => {
		const adapter = mockAdapter()
		const workflow = await generateWorkflow(adapter, 'Test goal')

		// inferEdges + validateGraph are called internally
		expect(workflow.graph.nodes.every(n => n.status === 'pending')).toBe(true)
	})

	it('returns empty workflow when planner returns nothing', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn(),
			generateContent: vi.fn().mockResolvedValue('[]'),
		}
		const workflow = await generateWorkflow(adapter, 'Empty goal')
		expect(workflow.graph.nodes).toHaveLength(0)
		expect(workflow.agents).toHaveLength(0)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/workflow-gen.test.ts`
Expected: FAIL — module not found

**Step 3: Implement workflow-gen.ts**

```typescript
// src/services/evo/workflow-gen.ts
import type { OpenAIAdapter } from '../../adapters/openai'
import type { WorkFlowGraph } from '../../types/workflow'
import type { AgentConfig } from '../../types/agents'
import { decomposeGoal } from './task-planner'
import { generateAgentConfig } from './agent-generator'
import { inferEdges, validateGraph } from './workflow-graph'

export interface GeneratedWorkflow {
	goal: string
	graph: WorkFlowGraph
	agents: AgentConfig[]
}

export async function generateWorkflow(
	adapter: OpenAIAdapter,
	goal: string,
): Promise<GeneratedWorkflow> {
	const nodes = await decomposeGoal(adapter, goal)

	if (nodes.length === 0) {
		return { goal, graph: { goal, nodes: [], edges: [] }, agents: [] }
	}

	const edges = inferEdges(nodes)
	const validation = validateGraph(nodes, edges)

	if (!validation.valid) {
		console.warn(`Generated graph is invalid: ${validation.error}. Using nodes without edges.`)
		return {
			goal,
			graph: { goal, nodes, edges: [] },
			agents: await Promise.all(nodes.map(n => generateAgentConfig(adapter, n))),
		}
	}

	const agents = await Promise.all(nodes.map(n => generateAgentConfig(adapter, n)))

	return {
		goal,
		graph: { goal, nodes, edges },
		agents,
	}
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/workflow-gen.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/services/evo/workflow-gen.ts tests/services/evo/workflow-gen.test.ts
git commit -m "feat(phase4): add workflow generator — goal to DAG orchestration"
```

---

### Task 8: Campaign Evaluator

**Files:**
- Create: `src/services/evo/evaluator.ts`
- Test: `tests/services/evo/evaluator.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/evaluator.test.ts
import { describe, it, expect, vi } from 'vitest'
import { evaluateCampaign, computeMetricScore } from '../../../src/services/evo/evaluator'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(response: string): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn().mockResolvedValue(response),
	}
}

describe('computeMetricScore', () => {
	it('computes weighted score from campaign stats', () => {
		const stats = {
			sent: 1000,
			delivered: 950,
			opened: 400,
			clicked: 80,
			bounced: 50,
			complained: 5,
		}
		const score = computeMetricScore(stats)
		expect(score).toBeGreaterThan(0)
		expect(score).toBeLessThanOrEqual(1)
	})

	it('returns 0 for zero sent', () => {
		const stats = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 }
		expect(computeMetricScore(stats)).toBe(0)
	})

	it('penalizes high bounce/complaint rates', () => {
		const good = computeMetricScore({
			sent: 1000, delivered: 990, opened: 400, clicked: 80, bounced: 10, complained: 0,
		})
		const bad = computeMetricScore({
			sent: 1000, delivered: 800, opened: 400, clicked: 80, bounced: 200, complained: 50,
		})
		expect(good).toBeGreaterThan(bad)
	})
})

describe('evaluateCampaign', () => {
	it('combines metric score with LLM quality assessment', async () => {
		const adapter = mockAdapter(JSON.stringify({ qualityScore: 0.8, feedback: 'Good targeting' }))
		const stats = {
			sent: 1000, delivered: 950, opened: 400, clicked: 80, bounced: 50, complained: 5,
		}

		const result = await evaluateCampaign(adapter, stats, 'Launch product email')
		expect(result.metricScore).toBeGreaterThan(0)
		expect(result.qualityScore).toBe(0.8)
		expect(result.combinedScore).toBeGreaterThan(0)
		expect(result.feedback).toBe('Good targeting')
	})

	it('uses metric score alone when LLM fails', async () => {
		const adapter = mockAdapter('invalid json')
		const stats = {
			sent: 1000, delivered: 950, opened: 400, clicked: 80, bounced: 50, complained: 5,
		}

		const result = await evaluateCampaign(adapter, stats, 'Some goal')
		expect(result.metricScore).toBeGreaterThan(0)
		expect(result.qualityScore).toBe(0)
		expect(result.combinedScore).toBe(result.metricScore)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/evaluator.test.ts`
Expected: FAIL — module not found

**Step 3: Implement evaluator.ts**

```typescript
// src/services/evo/evaluator.ts
import type { OpenAIAdapter } from '../../adapters/openai'

export interface CampaignStats {
	sent: number
	delivered: number
	opened: number
	clicked: number
	bounced: number
	complained: number
}

export interface EvaluationResult {
	metricScore: number
	qualityScore: number
	combinedScore: number
	feedback: string
}

const METRIC_WEIGHT = 0.6
const QUALITY_WEIGHT = 0.4

/** Compute a 0-1 score from campaign delivery stats. */
export function computeMetricScore(stats: CampaignStats): number {
	if (stats.sent === 0) return 0

	const deliveryRate = stats.delivered / stats.sent
	const openRate = stats.opened / stats.sent
	const clickRate = stats.clicked / stats.sent
	const bounceRate = stats.bounced / stats.sent
	const complaintRate = stats.complained / stats.sent

	const positiveSignal = deliveryRate * 0.2 + openRate * 0.35 + clickRate * 0.45
	const penalty = bounceRate * 0.5 + complaintRate * 1.5

	return Math.max(0, Math.min(1, positiveSignal - penalty))
}

/** Evaluate a campaign using both metrics and LLM quality assessment. */
export async function evaluateCampaign(
	adapter: OpenAIAdapter,
	stats: CampaignStats,
	goal: string,
): Promise<EvaluationResult> {
	const metricScore = computeMetricScore(stats)

	const systemPrompt = `You evaluate marketing campaign quality. Return JSON: { "qualityScore": number (0-1), "feedback": "brief assessment" }`
	const prompt = `Evaluate this campaign:
Goal: ${goal}
Stats: ${JSON.stringify(stats)}
Metric score: ${metricScore.toFixed(3)}`

	let qualityScore = 0
	let feedback = ''

	try {
		const response = await adapter.generateContent(prompt, systemPrompt)
		const parsed = JSON.parse(response) as { qualityScore: number; feedback: string }
		qualityScore = Math.max(0, Math.min(1, parsed.qualityScore))
		feedback = parsed.feedback
	} catch {
		// LLM unavailable — fall back to metrics only
	}

	const combinedScore = qualityScore > 0
		? metricScore * METRIC_WEIGHT + qualityScore * QUALITY_WEIGHT
		: metricScore

	return { metricScore, qualityScore, combinedScore, feedback }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/evaluator.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/services/evo/evaluator.ts tests/services/evo/evaluator.test.ts
git commit -m "feat(phase4): add campaign evaluator — metric scoring + LLM assessment"
```

---

### Task 9: TextGrad Prompt Optimizer

**Files:**
- Create: `src/services/evo/textgrad.ts`
- Test: `tests/services/evo/textgrad.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/textgrad.test.ts
import { describe, it, expect, vi } from 'vitest'
import { computeLoss, computeGradient, applyGradient } from '../../../src/services/evo/textgrad'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(response: string): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn().mockResolvedValue(response),
	}
}

describe('computeLoss', () => {
	it('asks LLM to evaluate prompt output quality and returns a loss string', async () => {
		const adapter = mockAdapter(JSON.stringify({
			loss: 0.4,
			analysis: 'The email is too generic and lacks personalization.',
		}))
		const result = await computeLoss(adapter, {
			prompt: 'Write a marketing email.',
			output: 'Dear customer, buy our product.',
			goal: 'Personalized product email',
		})
		expect(result.loss).toBe(0.4)
		expect(result.analysis).toContain('generic')
	})

	it('returns high loss on LLM failure', async () => {
		const adapter = mockAdapter('bad json')
		const result = await computeLoss(adapter, {
			prompt: 'test',
			output: 'test',
			goal: 'test',
		})
		expect(result.loss).toBe(1)
	})
})

describe('computeGradient', () => {
	it('asks LLM for prompt improvement suggestions', async () => {
		const adapter = mockAdapter(JSON.stringify({
			gradient: 'Add personalization tokens and urgency language.',
			suggestedPrompt: 'Write a personalized marketing email with urgency.',
		}))

		const result = await computeGradient(adapter, {
			prompt: 'Write a marketing email.',
			lossAnalysis: 'Too generic, lacks personalization.',
		})
		expect(result.gradient).toContain('personalization')
		expect(result.suggestedPrompt).toContain('personalized')
	})
})

describe('applyGradient', () => {
	it('asks LLM to apply gradient to produce improved prompt', async () => {
		const improved = 'Write a personalized, urgency-driven marketing email for {audience}.'
		const adapter = mockAdapter(improved)

		const result = await applyGradient(adapter, {
			currentPrompt: 'Write a marketing email.',
			gradient: 'Add personalization and urgency.',
		})
		expect(result).toContain('personalized')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/textgrad.test.ts`
Expected: FAIL — module not found

**Step 3: Implement textgrad.ts**

```typescript
// src/services/evo/textgrad.ts
import type { OpenAIAdapter } from '../../adapters/openai'

export interface LossInput {
	prompt: string
	output: string
	goal: string
}

export interface LossResult {
	loss: number
	analysis: string
}

export interface GradientInput {
	prompt: string
	lossAnalysis: string
}

export interface GradientResult {
	gradient: string
	suggestedPrompt: string
}

export interface ApplyGradientInput {
	currentPrompt: string
	gradient: string
}

/** Forward pass → loss function: LLM evaluates output quality relative to goal. */
export async function computeLoss(adapter: OpenAIAdapter, input: LossInput): Promise<LossResult> {
	const systemPrompt = `You evaluate the quality of AI-generated marketing content. Return JSON: { "loss": number (0=perfect, 1=terrible), "analysis": "what went wrong" }`
	const prompt = `Goal: ${input.goal}
Prompt used: ${input.prompt}
Output produced: ${input.output.slice(0, 2000)}

Rate the quality (0=perfect match to goal, 1=completely wrong).`

	try {
		const response = await adapter.generateContent(prompt, systemPrompt)
		const parsed = JSON.parse(response) as { loss: number; analysis: string }
		return {
			loss: Math.max(0, Math.min(1, parsed.loss)),
			analysis: parsed.analysis,
		}
	} catch {
		return { loss: 1, analysis: 'Failed to evaluate output' }
	}
}

/** Backward pass: LLM suggests how to improve the prompt based on the loss analysis. */
export async function computeGradient(
	adapter: OpenAIAdapter,
	input: GradientInput,
): Promise<GradientResult> {
	const systemPrompt = `You improve AI prompts based on quality feedback. Return JSON: { "gradient": "description of what to change", "suggestedPrompt": "improved prompt" }`
	const prompt = `Current prompt: ${input.prompt}
Quality issues: ${input.lossAnalysis}

Suggest specific improvements.`

	try {
		const response = await adapter.generateContent(prompt, systemPrompt)
		return JSON.parse(response) as GradientResult
	} catch {
		return { gradient: 'Unable to compute gradient', suggestedPrompt: input.prompt }
	}
}

/** Apply gradient: LLM rewrites the prompt incorporating the improvement suggestions. */
export async function applyGradient(
	adapter: OpenAIAdapter,
	input: ApplyGradientInput,
): Promise<string> {
	const systemPrompt = 'You rewrite prompts to incorporate improvements. Return ONLY the improved prompt text, nothing else.'
	const prompt = `Current prompt: ${input.currentPrompt}
Improvements to apply: ${input.gradient}

Rewrite the prompt incorporating these improvements.`

	return adapter.generateContent(prompt, systemPrompt)
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/textgrad.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/services/evo/textgrad.ts tests/services/evo/textgrad.test.ts
git commit -m "feat(phase4): add TextGrad — LLM-based prompt gradient descent"
```

---

### Task 10: Prompt Population (GA/DE Evolutionary Optimization)

**Files:**
- Create: `src/services/evo/prompt-population.ts`
- Test: `tests/services/evo/prompt-population.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/prompt-population.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
	crossoverPrompts,
	mutatePrompt,
	deMutatePrompt,
	selectParents,
} from '../../../src/services/evo/prompt-population'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(response: string): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn().mockResolvedValue(response),
	}
}

describe('selectParents', () => {
	it('selects top-scoring candidates as parents (tournament selection)', () => {
		const population = [
			{ prompt: 'a', score: 0.3 },
			{ prompt: 'b', score: 0.9 },
			{ prompt: 'c', score: 0.7 },
			{ prompt: 'd', score: 0.5 },
		]
		const parents = selectParents(population, 2)
		expect(parents).toHaveLength(2)
		expect(parents[0].score).toBeGreaterThanOrEqual(parents[1].score)
	})

	it('returns all if count >= population', () => {
		const pop = [{ prompt: 'a', score: 0.5 }]
		expect(selectParents(pop, 3)).toHaveLength(1)
	})
})

describe('crossoverPrompts', () => {
	it('combines two parent prompts via LLM', async () => {
		const adapter = mockAdapter('A hybrid prompt combining audience focus with urgency.')
		const child = await crossoverPrompts(adapter, 'Focus on audience needs.', 'Use urgency in messaging.')
		expect(child).toContain('hybrid')
	})
})

describe('mutatePrompt', () => {
	it('mutates a prompt via LLM', async () => {
		const adapter = mockAdapter('Focus on audience needs with emotional hooks and social proof.')
		const mutated = await mutatePrompt(adapter, 'Focus on audience needs.')
		expect(mutated).toContain('emotional')
	})
})

describe('deMutatePrompt', () => {
	it('applies differential evolution mutation via LLM', async () => {
		const adapter = mockAdapter('Target prompt enhanced with innovations from donor differences.')
		const result = await deMutatePrompt(adapter, {
			target: 'Basic prompt.',
			donor1: 'Prompt with feature A.',
			donor2: 'Prompt without feature A.',
		})
		expect(result).toContain('innovations')
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/prompt-population.test.ts`
Expected: FAIL — module not found

**Step 3: Implement prompt-population.ts**

```typescript
// src/services/evo/prompt-population.ts
import type { OpenAIAdapter } from '../../adapters/openai'

export interface ScoredPrompt {
	prompt: string
	score: number
}

/** Tournament selection: return the top-N candidates by score. */
export function selectParents(population: ScoredPrompt[], count: number): ScoredPrompt[] {
	const sorted = [...population].sort((a, b) => b.score - a.score)
	return sorted.slice(0, Math.min(count, sorted.length))
}

/** GA crossover: combine two parent prompts into a child via LLM. */
export async function crossoverPrompts(
	adapter: OpenAIAdapter,
	parent1: string,
	parent2: string,
): Promise<string> {
	const systemPrompt = 'You combine two marketing prompt strategies into one improved prompt. Return ONLY the combined prompt text.'
	const prompt = `Parent prompt 1: ${parent1}\n\nParent prompt 2: ${parent2}\n\nCombine the best elements of both into a single improved prompt.`

	return adapter.generateContent(prompt, systemPrompt)
}

/** GA mutation: introduce variations into a prompt via LLM. */
export async function mutatePrompt(
	adapter: OpenAIAdapter,
	original: string,
): Promise<string> {
	const systemPrompt = 'You introduce creative variations into marketing prompts while preserving their core intent. Return ONLY the mutated prompt text.'
	const prompt = `Original prompt: ${original}\n\nIntroduce a creative variation — add a new technique, adjust the angle, or enhance the strategy.`

	return adapter.generateContent(prompt, systemPrompt)
}

/** DE mutation: apply differential evolution using donor1-donor2 difference to target. */
export async function deMutatePrompt(
	adapter: OpenAIAdapter,
	input: { target: string; donor1: string; donor2: string },
): Promise<string> {
	const systemPrompt = 'You apply differential evolution to prompts. Identify the innovations in donor1 that are absent in donor2, then apply those innovations to the target. Return ONLY the improved prompt text.'
	const prompt = `Target prompt: ${input.target}
Donor 1 (has innovations): ${input.donor1}
Donor 2 (baseline): ${input.donor2}

Identify what donor1 has that donor2 lacks, then enhance the target with those innovations.`

	return adapter.generateContent(prompt, systemPrompt)
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/prompt-population.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/services/evo/prompt-population.ts tests/services/evo/prompt-population.test.ts
git commit -m "feat(phase4): add prompt population — GA crossover/mutation + DE evolution"
```

---

### Task 11: Optimizer Orchestrator

**Files:**
- Create: `src/services/evo/optimizer.ts`
- Test: `tests/services/evo/optimizer.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/optimizer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { runOptimizationCycle } from '../../../src/services/evo/optimizer'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn()
			// computeLoss responses
			.mockResolvedValueOnce(JSON.stringify({ loss: 0.6, analysis: 'Needs more personalization' }))
			// computeGradient response
			.mockResolvedValueOnce(JSON.stringify({ gradient: 'Add personalization', suggestedPrompt: 'Improved prompt v1' }))
			// applyGradient response
			.mockResolvedValueOnce('Improved prompt with personalization and urgency.')
			// crossover response
			.mockResolvedValueOnce('Crossover child prompt.')
			// mutate response
			.mockResolvedValueOnce('Mutated child prompt.'),
	}
}

describe('runOptimizationCycle', () => {
	it('runs a single optimization cycle with TextGrad + GA', async () => {
		const adapter = mockAdapter()
		const result = await runOptimizationCycle(adapter, {
			currentPrompt: 'Write a marketing email.',
			output: 'Dear customer, buy stuff.',
			goal: 'Personalized product launch email',
			population: [
				{ prompt: 'Prompt A', score: 0.5 },
				{ prompt: 'Prompt B', score: 0.3 },
			],
			strategy: 'hybrid',
		})

		expect(result.textgradPrompt).toBeDefined()
		expect(result.gaChildren.length).toBeGreaterThan(0)
		expect(result.loss).toBe(0.6)
		expect(result.gradient).toContain('personalization')
	})

	it('runs TextGrad only when strategy is textgrad', async () => {
		const adapter = mockAdapter()
		const result = await runOptimizationCycle(adapter, {
			currentPrompt: 'Write email.',
			output: 'Output.',
			goal: 'Goal.',
			population: [],
			strategy: 'textgrad',
		})

		expect(result.textgradPrompt).toBeDefined()
		expect(result.gaChildren).toHaveLength(0)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/optimizer.test.ts`
Expected: FAIL — module not found

**Step 3: Implement optimizer.ts**

```typescript
// src/services/evo/optimizer.ts
import type { OpenAIAdapter } from '../../adapters/openai'
import { computeLoss, computeGradient, applyGradient } from './textgrad'
import { selectParents, crossoverPrompts, mutatePrompt } from './prompt-population'
import type { ScoredPrompt } from './prompt-population'

export interface OptimizationInput {
	currentPrompt: string
	output: string
	goal: string
	population: ScoredPrompt[]
	strategy: 'textgrad' | 'ga' | 'de' | 'hybrid'
}

export interface OptimizationResult {
	textgradPrompt: string | null
	gaChildren: string[]
	loss: number
	gradient: string
}

export async function runOptimizationCycle(
	adapter: OpenAIAdapter,
	input: OptimizationInput,
): Promise<OptimizationResult> {
	let textgradPrompt: string | null = null
	let loss = 0
	let gradient = ''
	const gaChildren: string[] = []

	const useTextGrad = input.strategy === 'textgrad' || input.strategy === 'hybrid'
	const useGA = (input.strategy === 'ga' || input.strategy === 'hybrid') && input.population.length >= 2

	// TextGrad phase
	if (useTextGrad) {
		const lossResult = await computeLoss(adapter, {
			prompt: input.currentPrompt,
			output: input.output,
			goal: input.goal,
		})
		loss = lossResult.loss

		const gradientResult = await computeGradient(adapter, {
			prompt: input.currentPrompt,
			lossAnalysis: lossResult.analysis,
		})
		gradient = gradientResult.gradient

		textgradPrompt = await applyGradient(adapter, {
			currentPrompt: input.currentPrompt,
			gradient: gradientResult.gradient,
		})
	}

	// GA phase
	if (useGA) {
		const parents = selectParents(input.population, 2)
		const child = await crossoverPrompts(adapter, parents[0].prompt, parents[1].prompt)
		gaChildren.push(child)

		const mutated = await mutatePrompt(adapter, child)
		gaChildren.push(mutated)
	}

	return { textgradPrompt, gaChildren, loss, gradient }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/optimizer.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/services/evo/optimizer.ts tests/services/evo/optimizer.test.ts
git commit -m "feat(phase4): add optimizer orchestrator — TextGrad + GA/DE cycle runner"
```

---

### Task 12: HITL (Human-in-the-Loop) Service

**Files:**
- Create: `src/services/evo/hitl.ts`
- Test: `tests/services/evo/hitl.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/hitl.test.ts
import { describe, it, expect } from 'vitest'
import {
	createHitlRequest,
	resolveHitlRequest,
	isExpired,
	type HitlRequest,
	type HitlDecisionType,
} from '../../../src/services/evo/hitl'

describe('HITL service', () => {
	it('creates a HITL request with default 24h expiry', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: { content: 'Draft email for review' },
		})
		expect(req.decision).toBe('pending')
		expect(req.expiresAt.getTime()).toBeGreaterThan(Date.now())
	})

	it('creates a request with custom expiry', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
			expiryHours: 1,
		})
		const diff = req.expiresAt.getTime() - Date.now()
		expect(diff).toBeLessThanOrEqual(1 * 60 * 60 * 1000 + 1000)
		expect(diff).toBeGreaterThan(0)
	})

	it('resolves a pending request with approved', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
		})
		const resolved = resolveHitlRequest(req, 'approved', 'user-1')
		expect(resolved.decision).toBe('approved')
		expect(resolved.decidedBy).toBe('user-1')
		expect(resolved.decidedAt).toBeDefined()
	})

	it('resolves with modifications', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
		})
		const resolved = resolveHitlRequest(req, 'modified', 'user-1', { prompt: 'Updated' })
		expect(resolved.decision).toBe('modified')
		expect(resolved.modifications).toEqual({ prompt: 'Updated' })
	})

	it('throws if resolving a non-pending request', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
		})
		const resolved = resolveHitlRequest(req, 'approved', 'user-1')
		expect(() => resolveHitlRequest(resolved, 'rejected', 'user-2')).toThrow('not pending')
	})

	it('detects expired requests', () => {
		const req = createHitlRequest({
			tenantId: 't1',
			workflowId: 'w1',
			nodeId: 'n1',
			context: {},
		})
		expect(isExpired(req)).toBe(false)

		const expired: HitlRequest = {
			...req,
			expiresAt: new Date(Date.now() - 1000),
		}
		expect(isExpired(expired)).toBe(true)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/hitl.test.ts`
Expected: FAIL — module not found

**Step 3: Implement hitl.ts**

```typescript
// src/services/evo/hitl.ts
import { ValidationError } from '../../types/errors'

export type HitlDecisionType = 'pending' | 'approved' | 'rejected' | 'modified'

export interface HitlRequest {
	tenantId: string
	workflowId: string
	nodeId: string
	decision: HitlDecisionType
	context: Record<string, unknown>
	modifications?: Record<string, unknown>
	decidedBy?: string
	expiresAt: Date
	decidedAt?: Date
	createdAt: Date
}

interface CreateHitlInput {
	tenantId: string
	workflowId: string
	nodeId: string
	context: Record<string, unknown>
	expiryHours?: number
}

const DEFAULT_EXPIRY_HOURS = 24

export function createHitlRequest(input: CreateHitlInput): HitlRequest {
	const hours = input.expiryHours ?? DEFAULT_EXPIRY_HOURS
	return {
		tenantId: input.tenantId,
		workflowId: input.workflowId,
		nodeId: input.nodeId,
		decision: 'pending',
		context: input.context,
		expiresAt: new Date(Date.now() + hours * 60 * 60 * 1000),
		createdAt: new Date(),
	}
}

export function resolveHitlRequest(
	request: HitlRequest,
	decision: HitlDecisionType,
	decidedBy: string,
	modifications?: Record<string, unknown>,
): HitlRequest {
	if (request.decision !== 'pending') {
		throw new ValidationError(`HITL request is not pending (current: ${request.decision})`)
	}

	return {
		...request,
		decision,
		decidedBy,
		modifications,
		decidedAt: new Date(),
	}
}

export function isExpired(request: HitlRequest): boolean {
	return request.expiresAt.getTime() < Date.now()
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/hitl.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/services/evo/hitl.ts tests/services/evo/hitl.test.ts
git commit -m "feat(phase4): add HITL service — human approval queue with expiry"
```

---

### Task 13: Learning Loop Service

**Files:**
- Create: `src/services/evo/learning-loop.ts`
- Test: `tests/services/evo/learning-loop.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/services/evo/learning-loop.test.ts
import { describe, it, expect, vi } from 'vitest'
import { runLearningIteration, type LearningContext } from '../../../src/services/evo/learning-loop'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn()
			// evaluateCampaign: computeMetricScore is pure, LLM quality assessment
			.mockResolvedValueOnce(JSON.stringify({ qualityScore: 0.7, feedback: 'Good engagement' }))
			// optimizer: computeLoss
			.mockResolvedValueOnce(JSON.stringify({ loss: 0.3, analysis: 'Minor issues' }))
			// optimizer: computeGradient
			.mockResolvedValueOnce(JSON.stringify({ gradient: 'Improve CTA', suggestedPrompt: 'Better prompt' }))
			// optimizer: applyGradient
			.mockResolvedValueOnce('Optimized prompt with better CTA.')
			// optimizer: crossover
			.mockResolvedValueOnce('Crossover child.')
			// optimizer: mutate
			.mockResolvedValueOnce('Mutated child.'),
	}
}

describe('runLearningIteration', () => {
	it('runs evaluate → optimize cycle and returns results', async () => {
		const adapter = mockAdapter()
		const context: LearningContext = {
			currentPrompt: 'Write email for product launch.',
			campaignOutput: 'Dear customer, check out our new product!',
			goal: 'Drive product awareness',
			campaignStats: {
				sent: 1000, delivered: 950, opened: 380, clicked: 75, bounced: 50, complained: 3,
			},
			promptPopulation: [
				{ prompt: 'Prompt A', score: 0.5 },
				{ prompt: 'Prompt B', score: 0.4 },
			],
			strategy: 'hybrid',
		}

		const result = await runLearningIteration(adapter, context)
		expect(result.evaluation.combinedScore).toBeGreaterThan(0)
		expect(result.optimization.textgradPrompt).toBeDefined()
		expect(result.optimization.gaChildren.length).toBeGreaterThan(0)
		expect(result.candidatePrompts.length).toBeGreaterThan(0)
	})

	it('collects all candidate prompts for scoring', async () => {
		const adapter = mockAdapter()
		const context: LearningContext = {
			currentPrompt: 'Base prompt.',
			campaignOutput: 'Some output.',
			goal: 'Some goal.',
			campaignStats: {
				sent: 100, delivered: 95, opened: 30, clicked: 5, bounced: 5, complained: 0,
			},
			promptPopulation: [
				{ prompt: 'A', score: 0.6 },
				{ prompt: 'B', score: 0.4 },
			],
			strategy: 'hybrid',
		}

		const result = await runLearningIteration(adapter, context)
		// Should include: textgrad prompt + GA children
		expect(result.candidatePrompts.length).toBeGreaterThanOrEqual(1)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/services/evo/learning-loop.test.ts`
Expected: FAIL — module not found

**Step 3: Implement learning-loop.ts**

```typescript
// src/services/evo/learning-loop.ts
import type { OpenAIAdapter } from '../../adapters/openai'
import { evaluateCampaign, type CampaignStats, type EvaluationResult } from './evaluator'
import { runOptimizationCycle, type OptimizationResult } from './optimizer'
import type { ScoredPrompt } from './prompt-population'

export interface LearningContext {
	currentPrompt: string
	campaignOutput: string
	goal: string
	campaignStats: CampaignStats
	promptPopulation: ScoredPrompt[]
	strategy: 'textgrad' | 'ga' | 'de' | 'hybrid'
}

export interface LearningResult {
	evaluation: EvaluationResult
	optimization: OptimizationResult
	candidatePrompts: string[]
}

/** Run one full learning iteration: evaluate campaign → optimize prompts → collect candidates. */
export async function runLearningIteration(
	adapter: OpenAIAdapter,
	context: LearningContext,
): Promise<LearningResult> {
	const evaluation = await evaluateCampaign(
		adapter,
		context.campaignStats,
		context.goal,
	)

	const optimization = await runOptimizationCycle(adapter, {
		currentPrompt: context.currentPrompt,
		output: context.campaignOutput,
		goal: context.goal,
		population: context.promptPopulation,
		strategy: context.strategy,
	})

	const candidatePrompts: string[] = []
	if (optimization.textgradPrompt) {
		candidatePrompts.push(optimization.textgradPrompt)
	}
	candidatePrompts.push(...optimization.gaChildren)

	return { evaluation, optimization, candidatePrompts }
}
```

**Step 4: Run test to verify it passes**

Run: `bunx vitest run tests/services/evo/learning-loop.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/services/evo/learning-loop.ts tests/services/evo/learning-loop.test.ts
git commit -m "feat(phase4): add learning loop — evaluate + optimize + collect candidates"
```

---

### Task 14: Workflow Routes

**Files:**
- Create: `src/routes/workflows.ts`
- Modify: `src/routes/index.ts` (register new route)
- Test: `tests/routes/workflows.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/workflows.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createWorkflowRoutes } from '../../src/routes/workflows'

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([
						{
							id: 'wf-1',
							tenantId: 't1',
							goal: 'Launch campaign',
							status: 'pending',
							createdAt: new Date(),
							updatedAt: new Date(),
						},
					]),
				}),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{
					id: 'wf-new',
					tenantId: 't1',
					goal: 'New campaign',
					status: 'pending',
					createdAt: new Date(),
					updatedAt: new Date(),
				}]),
			}),
		}),
	}),
}))

describe('workflow routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('tenantId', 't1')
			c.set('userId', 'u1')
			await next()
		})
		app.route('/workflows', createWorkflowRoutes())
	})

	it('GET / lists workflows', async () => {
		const res = await app.request('/workflows')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
		expect(body.items[0].goal).toBe('Launch campaign')
	})

	it('POST / creates a workflow', async () => {
		const res = await app.request('/workflows', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ goal: 'New campaign' }),
		})
		expect(res.status).toBe(201)
		const body = await res.json()
		expect(body.id).toBe('wf-new')
	})

	it('POST / rejects empty goal', async () => {
		const res = await app.request('/workflows', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ goal: '' }),
		})
		expect(res.status).toBe(422)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/workflows.test.ts`
Expected: FAIL — module not found

**Step 3: Implement workflows route**

```typescript
// src/routes/workflows.ts
import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { workflows, workflowNodes, workflowEdges } from '../db/schema'
import { getDb } from '../db/client'
import { workflowCreate } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createWorkflowRoutes() {
	const router = new Hono<AppEnv>()

	// List workflows
	router.get('/', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(workflows)
			.where(eq(workflows.tenantId, tenantId))
			.orderBy(desc(workflows.createdAt))

		return c.json({ items })
	})

	// Create workflow
	router.post('/', validate('json', workflowCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(workflows).values({
			tenantId,
			goal: data.goal,
			campaignId: data.campaignId,
			metadata: data.metadata ?? {},
		}).returning()

		return c.json(created, 201)
	})

	// Get workflow with nodes and edges
	router.get('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [workflow] = await db
			.select()
			.from(workflows)
			.where(and(eq(workflows.id, id), eq(workflows.tenantId, tenantId)))
		if (!workflow) throw new NotFoundError('Workflow', id)

		const nodes = await db
			.select()
			.from(workflowNodes)
			.where(eq(workflowNodes.workflowId, id))

		const edges = await db
			.select()
			.from(workflowEdges)
			.where(eq(workflowEdges.workflowId, id))

		return c.json({ ...workflow, nodes, edges })
	})

	return router
}
```

**Step 4: Register in routes/index.ts**

Add to `src/routes/index.ts`:

```typescript
import { createWorkflowRoutes } from './workflows'
// ... in registerRoutes():
app.route('/api/v1/workflows', createWorkflowRoutes())
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/routes/workflows.test.ts`
Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add src/routes/workflows.ts src/routes/index.ts tests/routes/workflows.test.ts
git commit -m "feat(phase4): add workflow CRUD routes"
```

---

### Task 15: Evolution & HITL Routes

**Files:**
- Create: `src/routes/evolution.ts`
- Modify: `src/routes/index.ts` (register new route)
- Test: `tests/routes/evolution.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/routes/evolution.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AppEnv } from '../../src/app'
import { createEvolutionRoutes } from '../../src/routes/evolution'

vi.mock('../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					orderBy: vi.fn().mockResolvedValue([
						{ id: 'ec-1', tenantId: 't1', generation: 1, strategy: 'hybrid', status: 'completed' },
					]),
				}),
			}),
		}),
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{
					id: 'ec-new',
					tenantId: 't1',
					generation: 1,
					strategy: 'ga',
					status: 'pending',
				}]),
			}),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{
						id: 'hitl-1',
						decision: 'approved',
						decidedBy: 'u1',
					}]),
				}),
			}),
		}),
	}),
}))

describe('evolution routes', () => {
	let app: Hono<AppEnv>

	beforeEach(() => {
		app = new Hono<AppEnv>()
		app.use('*', async (c, next) => {
			c.set('tenantId', 't1')
			c.set('userId', 'u1')
			await next()
		})
		app.route('/evolution', createEvolutionRoutes())
	})

	it('GET /cycles lists evolution cycles', async () => {
		const res = await app.request('/evolution/cycles')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.items).toHaveLength(1)
	})

	it('POST /cycles starts a new evolution cycle', async () => {
		const res = await app.request('/evolution/cycles', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				agentConfigId: '550e8400-e29b-41d4-a716-446655440000',
				strategy: 'ga',
			}),
		})
		expect(res.status).toBe(201)
	})

	it('POST /hitl/:id/decide resolves a HITL request', async () => {
		const res = await app.request('/evolution/hitl/hitl-1/decide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ decision: 'approved' }),
		})
		expect(res.status).toBe(200)
	})

	it('POST /hitl/:id/decide rejects invalid decision', async () => {
		const res = await app.request('/evolution/hitl/hitl-1/decide', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ decision: 'maybe' }),
		})
		expect(res.status).toBe(422)
	})
})
```

**Step 2: Run test to verify it fails**

Run: `bunx vitest run tests/routes/evolution.test.ts`
Expected: FAIL — module not found

**Step 3: Implement evolution routes**

```typescript
// src/routes/evolution.ts
import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { evolutionCycles, hitlRequests } from '../db/schema'
import { getDb } from '../db/client'
import { evolutionStart, hitlDecision } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createEvolutionRoutes() {
	const router = new Hono<AppEnv>()

	// List evolution cycles
	router.get('/cycles', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(evolutionCycles)
			.where(eq(evolutionCycles.tenantId, tenantId))
			.orderBy(desc(evolutionCycles.createdAt))

		return c.json({ items })
	})

	// Start evolution cycle
	router.post('/cycles', validate('json', evolutionStart), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(evolutionCycles).values({
			tenantId,
			agentConfigId: data.agentConfigId,
			generation: 1,
			strategy: data.strategy,
		}).returning()

		return c.json(created, 201)
	})

	// List pending HITL requests
	router.get('/hitl', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(hitlRequests)
			.where(and(eq(hitlRequests.tenantId, tenantId), eq(hitlRequests.decision, 'pending')))
			.orderBy(desc(hitlRequests.createdAt))

		return c.json({ items })
	})

	// Decide on a HITL request
	router.post('/hitl/:id/decide', validate('json', hitlDecision), async (c) => {
		const db = getDb()
		const id = c.req.param('id')
		const userId = c.get('userId')!
		const data = c.req.valid('json')

		const [updated] = await db
			.update(hitlRequests)
			.set({
				decision: data.decision,
				decidedBy: userId,
				modifications: data.modifications,
				decidedAt: new Date(),
			})
			.where(and(eq(hitlRequests.id, id), eq(hitlRequests.decision, 'pending')))
			.returning()

		if (!updated) throw new NotFoundError('HITL request', id)

		return c.json(updated)
	})

	return router
}
```

**Step 4: Register in routes/index.ts**

Add to `src/routes/index.ts`:

```typescript
import { createEvolutionRoutes } from './evolution'
// ... in registerRoutes():
app.route('/api/v1/evolution', createEvolutionRoutes())
```

**Step 5: Run test to verify it passes**

Run: `bunx vitest run tests/routes/evolution.test.ts`
Expected: PASS (4 tests)

**Step 6: Commit**

```bash
git add src/routes/evolution.ts src/routes/index.ts tests/routes/evolution.test.ts
git commit -m "feat(phase4): add evolution and HITL API routes"
```

---

### Task 16: Integration Test — Full EvoAgentX Pipeline

**Files:**
- Create: `tests/integration/phase4.test.ts`

**Step 1: Write the integration test**

```typescript
// tests/integration/phase4.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { OpenAIAdapter } from '../../src/adapters/openai'
import type { WorkFlowNode, WorkFlowEdge } from '../../src/types/workflow'
import { inferEdges, getNextNodes, validateGraph, topologicalSort } from '../../src/services/evo/workflow-graph'
import { decomposeGoal } from '../../src/services/evo/task-planner'
import { generateAgentConfig } from '../../src/services/evo/agent-generator'
import { generateWorkflow } from '../../src/services/evo/workflow-gen'
import { computeMetricScore, evaluateCampaign } from '../../src/services/evo/evaluator'
import { computeLoss, computeGradient, applyGradient } from '../../src/services/evo/textgrad'
import { selectParents, crossoverPrompts, mutatePrompt } from '../../src/services/evo/prompt-population'
import { runOptimizationCycle } from '../../src/services/evo/optimizer'
import { runLearningIteration } from '../../src/services/evo/learning-loop'
import { createHitlRequest, resolveHitlRequest, isExpired } from '../../src/services/evo/hitl'

function createMockAdapter(responses: string[]): OpenAIAdapter {
	let callIdx = 0
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn().mockImplementation(() => {
			const response = responses[callIdx] ?? '{}'
			callIdx++
			return Promise.resolve(response)
		}),
	}
}

describe('Phase 4 Integration: EvoAgentX pipeline', () => {
	it('end-to-end: goal → workflow → evaluate → optimize → HITL', async () => {
		// 1. Generate workflow from a goal
		const adapter = createMockAdapter([
			// decomposeGoal response
			JSON.stringify([
				{
					name: 'research_audience',
					description: 'Research target audience',
					inputs: [{ name: 'goal', description: 'Campaign goal', required: true }],
					outputs: [{ name: 'audience_profile', description: 'Profile', required: true }],
				},
				{
					name: 'draft_content',
					description: 'Draft email content',
					inputs: [{ name: 'audience_profile', description: 'Profile', required: true }],
					outputs: [{ name: 'email_body', description: 'Email', required: true }],
				},
				{
					name: 'review_compliance',
					description: 'Check compliance',
					inputs: [{ name: 'email_body', description: 'Email', required: true }],
					outputs: [{ name: 'approved_body', description: 'Approved', required: true }],
				},
			]),
			// generateAgentConfig responses (3 nodes)
			JSON.stringify({ name: 'researcher', description: 'Research agent', systemPrompt: 'Research.', instructionPrompt: 'Do research.' }),
			JSON.stringify({ name: 'drafter', description: 'Draft agent', systemPrompt: 'Draft.', instructionPrompt: 'Draft email.' }),
			JSON.stringify({ name: 'reviewer', description: 'Review agent', systemPrompt: 'Review.', instructionPrompt: 'Review compliance.' }),
			// evaluateCampaign: LLM quality
			JSON.stringify({ qualityScore: 0.75, feedback: 'Solid campaign' }),
			// optimizer: computeLoss
			JSON.stringify({ loss: 0.35, analysis: 'Could improve personalization' }),
			// optimizer: computeGradient
			JSON.stringify({ gradient: 'Add dynamic personalization', suggestedPrompt: 'Improved prompt' }),
			// optimizer: applyGradient
			'Personalized and urgency-driven email prompt.',
			// optimizer: crossover
			'Crossover child prompt.',
			// optimizer: mutate
			'Mutated child prompt.',
		])

		// Step 1: Generate workflow
		const workflow = await generateWorkflow(adapter, 'Launch Q1 product email campaign')
		expect(workflow.graph.nodes).toHaveLength(3)
		expect(workflow.graph.edges).toHaveLength(2) // research→draft, draft→review
		expect(workflow.agents).toHaveLength(3)

		// Step 2: Validate DAG
		const validation = validateGraph(workflow.graph.nodes, workflow.graph.edges)
		expect(validation.valid).toBe(true)

		// Step 3: Topological sort
		const sorted = topologicalSort(workflow.graph.nodes, workflow.graph.edges)
		expect(sorted[0].name).toBe('research_audience')
		expect(sorted[2].name).toBe('review_compliance')

		// Step 4: Get next executable nodes
		const next = getNextNodes(workflow.graph.nodes, workflow.graph.edges)
		expect(next.map(n => n.name)).toEqual(['research_audience'])

		// Step 5: Simulate node completion, check next
		workflow.graph.nodes[0].status = 'completed'
		const next2 = getNextNodes(workflow.graph.nodes, workflow.graph.edges)
		expect(next2.map(n => n.name)).toEqual(['draft_content'])

		// Step 6: Run learning iteration (evaluate + optimize)
		const learningResult = await runLearningIteration(adapter, {
			currentPrompt: 'Write email for product launch.',
			campaignOutput: 'Dear customer, check out our product!',
			goal: 'Drive awareness for Q1 launch',
			campaignStats: {
				sent: 2000, delivered: 1900, opened: 760, clicked: 152, bounced: 100, complained: 8,
			},
			promptPopulation: [
				{ prompt: 'Prompt variant A', score: 0.5 },
				{ prompt: 'Prompt variant B', score: 0.4 },
			],
			strategy: 'hybrid',
		})
		expect(learningResult.evaluation.combinedScore).toBeGreaterThan(0)
		expect(learningResult.candidatePrompts.length).toBeGreaterThan(0)

		// Step 7: HITL gate
		const hitl = createHitlRequest({
			tenantId: 't1',
			workflowId: 'wf-1',
			nodeId: 'node-1',
			context: { content: learningResult.candidatePrompts[0] },
		})
		expect(hitl.decision).toBe('pending')
		expect(isExpired(hitl)).toBe(false)

		const resolved = resolveHitlRequest(hitl, 'approved', 'user-1')
		expect(resolved.decision).toBe('approved')
	})

	it('metric scoring produces consistent scores', () => {
		const highEngagement = computeMetricScore({
			sent: 1000, delivered: 980, opened: 500, clicked: 150, bounced: 20, complained: 0,
		})
		const lowEngagement = computeMetricScore({
			sent: 1000, delivered: 800, opened: 100, clicked: 10, bounced: 200, complained: 20,
		})
		expect(highEngagement).toBeGreaterThan(lowEngagement)
		expect(highEngagement).toBeGreaterThan(0.2)
	})

	it('select parents picks top scorers', () => {
		const parents = selectParents([
			{ prompt: 'worst', score: 0.1 },
			{ prompt: 'best', score: 0.9 },
			{ prompt: 'mid', score: 0.5 },
		], 2)
		expect(parents[0].prompt).toBe('best')
		expect(parents[1].prompt).toBe('mid')
	})
})
```

**Step 2: Run test to verify it passes**

Run: `bunx vitest run tests/integration/phase4.test.ts`
Expected: PASS (3 tests)

**Step 3: Commit**

```bash
git add tests/integration/phase4.test.ts
git commit -m "test(phase4): add integration test — full EvoAgentX pipeline"
```

---

### Task 17: Run Full Test Suite

**Step 1: Run all tests**

Run: `bunx vitest run`
Expected: ALL PASS — no regressions from Phase 1/2/3 tests

**Step 2: Run linter**

Run: `bunx biome check src/ tests/`
Expected: No errors

**Step 3: Fix any issues found**

If there are failures, fix them and re-run.

**Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix(phase4): resolve lint/test issues from full suite run"
```

---

## Summary

| Task | Component | New Files | Tests |
|------|-----------|-----------|-------|
| 1 | Type definitions | 2 | 7 |
| 2 | DB schemas (5 tables) | 6 | 9 |
| 3 | Zod API schemas | 0 (modify) | 8 |
| 4 | Workflow graph utilities | 1 | 10 |
| 5 | Task planner | 1 | 3 |
| 6 | Agent generator | 1 | 2 |
| 7 | Workflow generator | 1 | 3 |
| 8 | Campaign evaluator | 1 | 5 |
| 9 | TextGrad optimizer | 1 | 4 |
| 10 | Prompt population (GA/DE) | 1 | 5 |
| 11 | Optimizer orchestrator | 1 | 2 |
| 12 | HITL service | 1 | 6 |
| 13 | Learning loop | 1 | 2 |
| 14 | Workflow routes | 1 | 3 |
| 15 | Evolution + HITL routes | 1 | 4 |
| 16 | Integration test | 1 | 3 |
| 17 | Full suite validation | 0 | — |

**Total: ~20 new files, ~76 tests, 17 commits**
