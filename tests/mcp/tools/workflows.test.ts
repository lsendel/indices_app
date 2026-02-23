import { describe, it, expect, vi } from 'vitest'
import { handleGenerateWorkflow } from '../../../src/mcp/tools/workflows'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

describe('handleGenerateWorkflow', () => {
	it('generates a workflow DAG from a goal', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn(),
			generateContent: vi.fn()
				.mockResolvedValueOnce(JSON.stringify([
					{ name: 'research', description: 'Research', inputs: [], outputs: [{ name: 'data', description: 'd', required: true }] },
					{ name: 'draft', description: 'Draft', inputs: [{ name: 'data', description: 'd', required: true }], outputs: [] },
				]))
				.mockResolvedValue(JSON.stringify({ name: 'agent', description: 'desc', systemPrompt: 'sp', instructionPrompt: 'ip' })),
		}
		const result = await handleGenerateWorkflow('Launch campaign', adapter)
		expect(result.goal).toBe('Launch campaign')
		expect(result.graph.nodes).toHaveLength(2)
	})
})
