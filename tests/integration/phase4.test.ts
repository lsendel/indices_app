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
	it('end-to-end: goal -> workflow -> evaluate -> optimize -> HITL', async () => {
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
		expect(workflow.graph.edges).toHaveLength(2) // research->draft, draft->review
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
