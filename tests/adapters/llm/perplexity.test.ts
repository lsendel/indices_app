import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createPerplexityProvider } from '../../../src/adapters/llm/perplexity'

vi.mock('openai', () => {
	const mockCreate = vi.fn()
	return {
		default: class {
			constructor(public opts: any) {}
			chat = { completions: { create: mockCreate } }
		},
		__mockCreate: mockCreate,
	}
})

describe('PerplexityProvider', () => {
	let mockCreate: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('openai')
		mockCreate = (mod as any).__mockCreate
		mockCreate.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createPerplexityProvider('test-key')
		expect(provider.name).toBe('perplexity')
		expect(provider.capabilities.has('search')).toBe(true)
	})

	it('should generate text via OpenAI-compatible API', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: 'Research result' } }],
		})

		const provider = createPerplexityProvider('test-key')
		const result = await provider.generateText('Research this topic')
		expect(result).toBe('Research result')
	})

	it('should generate JSON', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: '{"findings": ["a", "b"]}' } }],
		})

		const schema = z.object({ findings: z.array(z.string()) })
		const provider = createPerplexityProvider('test-key')
		const result = await provider.generateJSON('Find info', schema)
		expect(result).toEqual({ findings: ['a', 'b'] })
	})
})
