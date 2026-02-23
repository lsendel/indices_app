import { describe, it, expect, vi } from 'vitest'
import { decomposeGoal } from '../../../src/services/evo/task-planner'
import type { LLMProvider } from '../../../src/adapters/llm/types'
import type { WorkFlowNode } from '../../../src/types/workflow'

function mockProvider(response: string): LLMProvider {
	return {
		name: 'mock',
		capabilities: new Set(['text', 'json']),
		generateText: vi.fn().mockResolvedValue(response),
		generateJSON: vi.fn(),
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
		const provider = mockProvider(llmResponse)

		const nodes = await decomposeGoal(provider, 'Launch product email campaign')
		expect(nodes).toHaveLength(2)
		expect(nodes[0].name).toBe('research_audience')
		expect(nodes[0].status).toBe('pending')
		expect(nodes[0].agentId).toBeNull()
		expect(nodes[1].inputs[0].name).toBe('audience_profile')
	})

	it('passes goal to generateText with correct system prompt', async () => {
		const provider = mockProvider('[]')
		await decomposeGoal(provider, 'My goal')

		expect(provider.generateText).toHaveBeenCalledWith(
			expect.stringContaining('My goal'),
			expect.objectContaining({ systemPrompt: expect.stringContaining('task planner') }),
		)
	})

	it('returns empty array for invalid LLM response', async () => {
		const provider = mockProvider('not valid json')
		const nodes = await decomposeGoal(provider, 'Some goal')
		expect(nodes).toEqual([])
	})
})
