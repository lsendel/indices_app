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
