import OpenAI from 'openai'
import { getConfig } from '../config'

export interface OpenAIAdapter {
	analyzeSentiment(text: string, brand: string): Promise<{ score: number; themes: string[] }>
	generateContent(prompt: string, systemPrompt?: string): Promise<string>
}

export function createOpenAIAdapter(): OpenAIAdapter {
	const config = getConfig()
	const apiKey = config.OPENAI_API_KEY

	const client = apiKey ? new OpenAI({ apiKey }) : null

	return {
		async analyzeSentiment(text: string, brand: string) {
			if (!client) {
				throw new Error('OpenAI API key not configured — set OPENAI_API_KEY environment variable')
			}

			const response = await client.chat.completions.create({
				model: config.OPENAI_MODEL,
				response_format: { type: 'json_object' },
				messages: [
					{ role: 'system', content: 'You analyze sentiment. Return JSON: { "score": number (-1 to 1), "themes": string[] }' },
					{ role: 'user', content: `Analyze sentiment about "${brand}" in this text:\n\n${text.slice(0, 2000)}` },
				],
				temperature: 0.3,
				max_tokens: 200,
			})

			const content = response.choices[0]?.message?.content ?? '{}'
			try {
				return JSON.parse(content) as { score: number; themes: string[] }
			} catch (e) {
				if (!(e instanceof SyntaxError)) throw e
				console.warn('analyzeSentiment: failed to parse OpenAI response', { brand, error: e.message })
				return { score: 0, themes: [] }
			}
		},

		async generateContent(prompt: string, systemPrompt?: string) {
			if (!client) {
				throw new Error('OpenAI API key not configured — set OPENAI_API_KEY environment variable')
			}

			const response = await client.chat.completions.create({
				model: config.OPENAI_MODEL,
				messages: [
					...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
					{ role: 'user' as const, content: prompt },
				],
				temperature: 0.7,
				max_tokens: 1000,
			})

			return response.choices[0]?.message?.content ?? ''
		},
	}
}
