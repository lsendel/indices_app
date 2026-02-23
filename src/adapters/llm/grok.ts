import OpenAI from 'openai'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createGrokProvider(apiKey: string, defaultModel = 'grok-3'): LLMProvider {
	const client = new OpenAI({
		apiKey,
		baseURL: 'https://api.x.ai/v1',
	})

	return {
		name: 'grok',
		capabilities: new Set(['text', 'json', 'realtime']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
			if (opts?.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt })
			messages.push({ role: 'user', content: prompt })

			const response = await client.chat.completions.create({
				model: opts?.model ?? defaultModel,
				messages,
				temperature: opts?.temperature ?? 0.7,
				max_tokens: opts?.maxTokens ?? 1000,
			})

			const content = response.choices[0]?.message?.content
			if (!content) throw new Error('Grok returned empty response')
			return content
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const jsonPrompt = `${prompt}\n\nRespond with valid JSON only.`
			const text = await this.generateText(jsonPrompt, { ...opts, temperature: opts?.temperature ?? 0.3 })
			const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
			return schema.parse(JSON.parse(cleaned))
		},
	}
}
