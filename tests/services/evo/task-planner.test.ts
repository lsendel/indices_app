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
