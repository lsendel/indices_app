import { describe, it, expect, vi } from 'vitest'
import { handleGeneratePersona } from '../../../src/mcp/tools/personas'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

describe('handleGeneratePersona', () => {
	it('generates a persona from a segment', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn(),
			generateContent: vi.fn().mockResolvedValue(JSON.stringify({
				name: 'Marketing Director',
				description: 'Mid-career professional',
				motivations: ['ROI'],
			})),
		}
		const result = await handleGeneratePersona('segment-1', adapter, 'tenant-1')
		expect(result.persona).toBeDefined()
	})
})
