import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createGrokProvider } from '../../../src/adapters/llm/grok'

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

describe('GrokProvider', () => {
	let mockCreate: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('openai')
		mockCreate = (mod as any).__mockCreate
		mockCreate.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createGrokProvider('test-key')
		expect(provider.name).toBe('grok')
		expect(provider.capabilities.has('realtime')).toBe(true)
	})

	it('should generate text', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: 'Trending now' } }],
		})

		const provider = createGrokProvider('test-key')
		const result = await provider.generateText('What is trending?')
		expect(result).toBe('Trending now')
	})
})
