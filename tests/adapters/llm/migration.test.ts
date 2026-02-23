import { describe, it, expect } from 'vitest'
import type { LLMProvider } from '../../../src/adapters/llm/types'

describe('OpenAIAdapter migration', () => {
	it('LLMProvider interface covers generateContent use case', async () => {
		const provider: LLMProvider = {
			name: 'test',
			capabilities: new Set(['text']),
			async generateText(prompt, opts) { return 'migrated' },
			async generateJSON(prompt, schema) { return {} },
		}

		// Old: adapter.generateContent(prompt, systemPrompt)
		// New: provider.generateText(prompt, { systemPrompt })
		const result = await provider.generateText('test prompt', { systemPrompt: 'system' })
		expect(result).toBe('migrated')
	})

	it('LLMProvider interface covers analyzeSentiment use case', async () => {
		const { z } = await import('zod')
		const sentimentSchema = z.object({ score: z.number(), themes: z.array(z.string()) })

		const provider: LLMProvider = {
			name: 'test',
			capabilities: new Set(['text', 'json']),
			async generateText() { return '' },
			async generateJSON(_prompt, schema) {
				return schema.parse({ score: 0.5, themes: ['positive'] })
			},
		}

		const result = await provider.generateJSON('analyze', sentimentSchema)
		expect(result.score).toBe(0.5)
		expect(result.themes).toContain('positive')
	})
})
