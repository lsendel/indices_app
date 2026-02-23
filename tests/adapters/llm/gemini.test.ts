import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createGeminiProvider } from '../../../src/adapters/llm/gemini'

vi.mock('@google/generative-ai', () => {
	const mockGenerateContent = vi.fn()
	return {
		GoogleGenerativeAI: class {
			getGenerativeModel() {
				return { generateContent: mockGenerateContent }
			}
		},
		__mockGenerateContent: mockGenerateContent,
	}
})

describe('GeminiProvider', () => {
	let mockGenerateContent: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('@google/generative-ai')
		mockGenerateContent = (mod as any).__mockGenerateContent
		mockGenerateContent.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createGeminiProvider('test-key')
		expect(provider.name).toBe('gemini')
		expect(provider.capabilities.has('vision')).toBe(true)
	})

	it('should generate text', async () => {
		mockGenerateContent.mockResolvedValueOnce({
			response: { text: () => 'Hello from Gemini' },
		})

		const provider = createGeminiProvider('test-key')
		const result = await provider.generateText('Say hello')
		expect(result).toBe('Hello from Gemini')
	})

	it('should generate JSON with schema validation', async () => {
		mockGenerateContent.mockResolvedValueOnce({
			response: { text: () => '{"title": "My Video", "duration": 30}' },
		})

		const schema = z.object({ title: z.string(), duration: z.number() })
		const provider = createGeminiProvider('test-key')
		const result = await provider.generateJSON('Generate video metadata', schema)
		expect(result).toEqual({ title: 'My Video', duration: 30 })
	})
})
