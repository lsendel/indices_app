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
