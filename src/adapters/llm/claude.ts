import Anthropic from '@anthropic-ai/sdk'
import type { z } from 'zod'
import type { LLMProvider, GenerateOpts } from './types'

export function createClaudeProvider(apiKey: string, defaultModel = 'claude-sonnet-4-20250514'): LLMProvider {
	const client = new Anthropic({ apiKey })

	return {
		name: 'claude',
		capabilities: new Set(['text', 'json']),

		async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
			const response = await client.messages.create({
				model: opts?.model ?? defaultModel,
				max_tokens: opts?.maxTokens ?? 1000,
				...(opts?.systemPrompt ? { system: opts.systemPrompt } : {}),
				messages: [{ role: 'user', content: prompt }],
			})

			const block = response.content[0]
			if (!block || block.type !== 'text') {
				throw new Error('Claude returned empty response')
			}
			return block.text
		},

		async generateJSON<T>(prompt: string, schema: z.ZodType<T>, opts?: GenerateOpts): Promise<T> {
			const jsonPrompt = `${prompt}\n\nRespond with valid JSON only. No markdown, no explanation.`
			const text = await this.generateText(jsonPrompt, {
				...opts,
				temperature: opts?.temperature ?? 0.3,
			})

			// Strip markdown fences if present
			const cleaned = text.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim()
			return schema.parse(JSON.parse(cleaned))
		},
	}
}
