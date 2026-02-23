import { GoogleGenerativeAI } from '@google/generative-ai'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createGeminiProvider(apiKey: string, defaultModel = 'gemini-2.0-flash'): LLMProvider {
	const genAI = new GoogleGenerativeAI(apiKey)

	return {
		name: 'gemini',
		capabilities: new Set(['text', 'json', 'vision']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const model = genAI.getGenerativeModel({ model: opts?.model ?? defaultModel })
			const fullPrompt = opts?.systemPrompt ? `${opts.systemPrompt}\n\n${prompt}` : prompt

			const result = await model.generateContent(fullPrompt)
			const text = result.response.text()
			if (!text) {
				throw new Error('Gemini returned empty response')
			}
			return text
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const jsonPrompt = `${prompt}\n\nRespond with valid JSON only. No markdown, no explanation.`
			const text = await this.generateText(jsonPrompt, {
				...opts,
				temperature: opts?.temperature ?? 0.3,
			})

			const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
			return schema.parse(JSON.parse(cleaned))
		},
	}
}
