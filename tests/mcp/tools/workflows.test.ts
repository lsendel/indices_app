import { describe, it, expect, vi } from 'vitest'
import { handleGenerateWorkflow } from '../../../src/mcp/tools/workflows'
import type { LLMProvider } from '../../../src/adapters/llm/types'

describe('handleGenerateWorkflow', () => {
	it('generates a workflow DAG from a goal', async () => {
		const provider: LLMProvider = {
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn()
				.mockResolvedValueOnce(JSON.stringify([
					{ name: 'research', description: 'Research', inputs: [], outputs: [{ name: 'data', description: 'd', required: true }] },
					{ name: 'draft', description: 'Draft', inputs: [{ name: 'data', description: 'd', required: true }], outputs: [] },
				]))
				.mockResolvedValue(JSON.stringify({ name: 'agent', description: 'desc', systemPrompt: 'sp', instructionPrompt: 'ip' })),
			generateJSON: vi.fn(),
		}
		const result = await handleGenerateWorkflow('Launch campaign', provider)
		expect(result.goal).toBe('Launch campaign')
		expect(result.graph.nodes).toHaveLength(2)
	})
})
