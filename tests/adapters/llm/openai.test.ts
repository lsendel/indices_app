import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createOpenAIProvider } from '../../../src/adapters/llm/openai'

// Mock the openai module
vi.mock('openai', () => {
	const mockCreate = vi.fn()
	return {
		default: class {
			chat = { completions: { create: mockCreate } }
		},
		__mockCreate: mockCreate,
	}
})

describe('OpenAIProvider', () => {
	let mockCreate: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('openai')
		mockCreate = (mod as any).__mockCreate
		mockCreate.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createOpenAIProvider('test-key')
		expect(provider.name).toBe('openai')
		expect(provider.capabilities.has('text')).toBe(true)
		expect(provider.capabilities.has('json')).toBe(true)
		expect(provider.capabilities.has('vision')).toBe(true)
	})

	it('should generate text', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: 'Hello world' } }],
		})

		const provider = createOpenAIProvider('test-key')
		const result = await provider.generateText('Say hello')
		expect(result).toBe('Hello world')
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					expect.objectContaining({ role: 'user', content: 'Say hello' }),
				]),
			}),
		)
	})

	it('should generate JSON with schema validation', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: '{"score": 0.8, "label": "positive"}' } }],
		})

		const schema = z.object({ score: z.number(), label: z.string() })
		const provider = createOpenAIProvider('test-key')
		const result = await provider.generateJSON('Analyze this', schema)
		expect(result).toEqual({ score: 0.8, label: 'positive' })
	})

	it('should include system prompt when provided', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: 'response' } }],
		})

		const provider = createOpenAIProvider('test-key')
		await provider.generateText('prompt', { systemPrompt: 'Be concise' })
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				messages: expect.arrayContaining([
					{ role: 'system', content: 'Be concise' },
				]),
			}),
		)
	})

	it('should throw on empty response', async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: null } }],
		})

		const provider = createOpenAIProvider('test-key')
		await expect(provider.generateText('prompt')).rejects.toThrow('empty')
	})
})
