import { describe, it, expect, vi, beforeEach } from 'vitest'
import { z } from 'zod'
import { createHuggingFaceProvider } from '../../../src/adapters/llm/huggingface'

vi.mock('@huggingface/inference', () => {
	const mockTextGeneration = vi.fn()
	return {
		HfInference: class {
			textGeneration = mockTextGeneration
		},
		__mockTextGeneration: mockTextGeneration,
	}
})

describe('HuggingFaceProvider', () => {
	let mockTextGeneration: ReturnType<typeof vi.fn>

	beforeEach(async () => {
		const mod = await import('@huggingface/inference')
		mockTextGeneration = (mod as any).__mockTextGeneration
		mockTextGeneration.mockReset()
	})

	it('should have correct name and capabilities', () => {
		const provider = createHuggingFaceProvider('test-key')
		expect(provider.name).toBe('huggingface')
		expect(provider.capabilities.has('text')).toBe(true)
	})

	it('should generate text', async () => {
		mockTextGeneration.mockResolvedValueOnce({
			generated_text: 'HF output',
		})

		const provider = createHuggingFaceProvider('test-key')
		const result = await provider.generateText('Generate something')
		expect(result).toBe('HF output')
	})

	it('should generate JSON', async () => {
		mockTextGeneration.mockResolvedValueOnce({
			generated_text: '{"items": [1, 2, 3]}',
		})

		const schema = z.object({ items: z.array(z.number()) })
		const provider = createHuggingFaceProvider('test-key')
		const result = await provider.generateJSON('List items', schema)
		expect(result).toEqual({ items: [1, 2, 3] })
	})
})
