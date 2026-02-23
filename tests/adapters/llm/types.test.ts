import { describe, it, expect } from 'vitest'
import type { LLMProvider, GenerateOpts } from '../../../src/adapters/llm/types'

describe('LLMProvider types', () => {
	it('should type-check a valid provider implementation', () => {
		const provider: LLMProvider = {
			name: 'test',
			capabilities: new Set(['text', 'json']),
			async generateText(prompt: string, opts?: GenerateOpts) {
				return 'hello'
			},
			async generateJSON(prompt: string, schema: any, opts?: GenerateOpts) {
				return { result: true }
			},
		}
		expect(provider.name).toBe('test')
		expect(provider.capabilities.has('text')).toBe(true)
	})

	it('should type-check GenerateOpts', () => {
		const opts: GenerateOpts = {
			systemPrompt: 'You are helpful',
			temperature: 0.7,
			maxTokens: 1000,
			model: 'gpt-4o',
		}
		expect(opts.temperature).toBe(0.7)
	})
})
