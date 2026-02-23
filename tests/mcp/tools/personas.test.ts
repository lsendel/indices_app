import { describe, it, expect, vi } from 'vitest'
import { handleGeneratePersona } from '../../../src/mcp/tools/personas'
import type { LLMProvider } from '../../../src/adapters/llm/types'

describe('handleGeneratePersona', () => {
	it('generates a persona from a segment', async () => {
		const provider: LLMProvider = {
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn().mockResolvedValue(JSON.stringify({
				name: 'Marketing Director',
				description: 'Mid-career professional',
				motivations: ['ROI'],
			})),
			generateJSON: vi.fn(),
		}
		const result = await handleGeneratePersona('segment-1', provider, 'tenant-1')
		expect(result.persona).toBeDefined()
	})
})
