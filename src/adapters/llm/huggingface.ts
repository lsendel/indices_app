import { HfInference } from '@huggingface/inference'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createHuggingFaceProvider(apiKey: string, defaultModel = 'mistralai/Mistral-7B-Instruct-v0.3'): LLMProvider {
	const client = new HfInference(apiKey)

	return {
		name: 'huggingface',
		capabilities: new Set(['text', 'json']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const fullPrompt = opts?.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt

			const result = await client.textGeneration({
				model: opts?.model ?? defaultModel,
				inputs: fullPrompt,
				parameters: {
					temperature: opts?.temperature ?? 0.7,
					max_new_tokens: opts?.maxTokens ?? 1000,
					return_full_text: false,
				},
			})

			if (!result.generated_text) {
				throw new Error('HuggingFace returned empty response')
			}
			return result.generated_text
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const jsonPrompt = `${prompt}\n\nRespond with valid JSON only. No explanation.`
			const text = await this.generateText(jsonPrompt, { ...opts, temperature: opts?.temperature ?? 0.3 })
			const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
			return schema.parse(JSON.parse(cleaned))
		},
	}
}
