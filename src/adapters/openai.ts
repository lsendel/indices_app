/**
 * @deprecated Use `src/adapters/llm` instead. This adapter is kept for backward compatibility.
 * Migration: import { createLLMRouterFromConfig } from './llm/factory'
 */
import { z } from 'zod'
import type { LLMProvider } from './llm/types'
import { createOpenAIProvider } from './llm/openai'

export type OpenAIAdapter = {
	analyzeSentiment(text: string, brand: string): Promise<{ score: number; themes: string[] }>
	generateContent(prompt: string, systemPrompt?: string): Promise<string>
}

/** @deprecated Use createLLMRouterFromConfig instead */
export function createOpenAIAdapter(config: { OPENAI_API_KEY?: string; OPENAI_MODEL?: string }): OpenAIAdapter {
	if (!config.OPENAI_API_KEY) {
		throw new Error('OpenAI API key not configured')
	}
	const provider: LLMProvider = createOpenAIProvider(config.OPENAI_API_KEY, config.OPENAI_MODEL)

	return {
		async analyzeSentiment(text, brand) {
			const schema = z.object({ score: z.number(), themes: z.array(z.string()) })
			return provider.generateJSON(
				`Analyze sentiment about "${brand}" in this text:\n\n${text.slice(0, 2000)}`,
				schema,
				{ systemPrompt: 'You analyze sentiment. Return JSON: { "score": number (-1 to 1), "themes": string[] }' },
			)
		},
		async generateContent(prompt, systemPrompt) {
			return provider.generateText(prompt, { systemPrompt })
		},
	}
}
