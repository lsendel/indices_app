import { describe, it, expect, vi } from 'vitest'
import { enrichArticles } from '../../../src/services/scraper/enrichment'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

describe('enrichArticles', () => {
	it('runs sentiment analysis on articles with content', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockResolvedValue({ score: 0.7, themes: ['innovation'] }),
			generateContent: vi.fn(),
		}
		const { results, failedCount } = await enrichArticles(adapter, [
			{ id: 'a1', title: 'Great launch', content: 'Product exceeded expectations.', brand: 'Acme' },
			{ id: 'a2', title: 'No body', content: null, brand: 'Acme' },
		])
		expect(results).toHaveLength(1)
		expect(results[0].sentiment.score).toBe(0.7)
		expect(failedCount).toBe(0)
	})

	it('throws when all articles fail enrichment', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockRejectedValue(new Error('LLM error')),
			generateContent: vi.fn(),
		}
		await expect(
			enrichArticles(adapter, [{ id: 'a1', title: 'Test', content: 'Content', brand: 'B' }]),
		).rejects.toThrow('all 1 articles failed enrichment (last error: Error: LLM error)')
	})

	it('returns partial results when some articles fail', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn()
				.mockResolvedValueOnce({ score: 0.5, themes: ['tech'] })
				.mockRejectedValueOnce(new Error('LLM error')),
			generateContent: vi.fn(),
		}
		const { results, failedCount } = await enrichArticles(adapter, [
			{ id: 'a1', title: 'Good', content: 'Works fine.', brand: 'B' },
			{ id: 'a2', title: 'Bad', content: 'Fails here.', brand: 'B' },
		])
		expect(results).toHaveLength(1)
		expect(results[0].articleId).toBe('a1')
		expect(failedCount).toBe(1)
	})
})
