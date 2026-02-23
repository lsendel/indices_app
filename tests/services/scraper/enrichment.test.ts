import { describe, it, expect, vi } from 'vitest'
import { enrichArticles } from '../../../src/services/scraper/enrichment'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

describe('enrichArticles', () => {
	it('runs sentiment analysis on articles with content', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockResolvedValue({ score: 0.7, themes: ['innovation'] }),
			generateContent: vi.fn(),
		}
		const results = await enrichArticles(adapter, [
			{ id: 'a1', title: 'Great launch', content: 'Product exceeded expectations.', brand: 'Acme' },
			{ id: 'a2', title: 'No body', content: null, brand: 'Acme' },
		])
		expect(results).toHaveLength(1)
		expect(results[0].sentiment.score).toBe(0.7)
	})

	it('skips articles where analysis fails', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockRejectedValue(new Error('LLM error')),
			generateContent: vi.fn(),
		}
		const results = await enrichArticles(adapter, [{ id: 'a1', title: 'Test', content: 'Content', brand: 'B' }])
		expect(results).toHaveLength(0)
	})
})
