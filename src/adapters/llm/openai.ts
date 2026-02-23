import OpenAI from 'openai'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createOpenAIProvider(apiKey: string, defaultModel = 'gpt-4o'): LLMProvider {
	const client = new OpenAI({ apiKey })

	return {
		name: 'openai',
		capabilities: new Set(['text', 'json', 'vision']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
			if (opts?.systemPrompt) {
				messages.push({ role: 'system', content: opts.systemPrompt })
			}
			messages.push({ role: 'user', content: prompt })

			const response = await client.chat.completions.create({
				model: opts?.model ?? defaultModel,
				messages,
				temperature: opts?.temperature ?? 0.7,
				max_tokens: opts?.maxTokens ?? 1000,
			})

			const content = response.choices[0]?.message?.content
			if (!content) {
				throw new Error('OpenAI returned empty response')
			}
			return content
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
			if (opts?.systemPrompt) {
				messages.push({ role: 'system', content: opts.systemPrompt })
			}
			messages.push({ role: 'user', content: prompt })

			const response = await client.chat.completions.create({
				model: opts?.model ?? defaultModel,
				messages,
				response_format: { type: 'json_object' },
				temperature: opts?.temperature ?? 0.3,
				max_tokens: opts?.maxTokens ?? 1000,
			})

			const content = response.choices[0]?.message?.content
			if (!content) {
				throw new Error('OpenAI returned empty response')
			}
			return schema.parse(JSON.parse(content))
		},
	}
}
