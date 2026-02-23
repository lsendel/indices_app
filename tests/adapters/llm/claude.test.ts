import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createClaudeProvider } from '../../../src/adapters/llm/claude'

vi.mock('@anthropic-ai/sdk', () => {
	const mockCreate = vi.fn()
	return {
		default: class {
			messages = { create: mockCreate }
		},
		__mockCreate: mockCreate,
	}
})

describe('ClaudeProvider', () => {
	let mockCreate: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('@anthropic-ai/sdk')
		mockCreate = (mod as any).__mockCreate
		mockCreate.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createClaudeProvider('test-key')
		expect(provider.name).toBe('claude')
		expect(provider.capabilities.has('text')).toBe(true)
		expect(provider.capabilities.has('json')).toBe(true)
		expect(provider.capabilities.has('vision')).toBe(false)
	})

	it('should generate text', async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: 'text', text: 'Hello from Claude' }],
		})

		const provider = createClaudeProvider('test-key')
		const result = await provider.generateText('Say hello')
		expect(result).toBe('Hello from Claude')
	})

	it('should generate JSON with schema validation', async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: 'text', text: '{"name": "Alice", "age": 30}' }],
		})

		const schema = z.object({ name: z.string(), age: z.number() })
		const provider = createClaudeProvider('test-key')
		const result = await provider.generateJSON('Generate person', schema)
		expect(result).toEqual({ name: 'Alice', age: 30 })
	})

	it('should pass system prompt correctly', async () => {
		mockCreate.mockResolvedValueOnce({
			content: [{ type: 'text', text: 'response' }],
		})

		const provider = createClaudeProvider('test-key')
		await provider.generateText('prompt', { systemPrompt: 'Be brief' })
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				system: 'Be brief',
			}),
		)
	})
})
