import { describe, it, expect, vi } from 'vitest'
import { enrichArticles } from '../../../src/services/scraper/enrichment'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

vi.mock('../../../src/utils/logger', () => ({
	logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

function mockAdapter(): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn().mockResolvedValue({ score: 0.7, themes: ['positive', 'innovation'] }),
		generateContent: vi.fn(),
	}
}

describe('enrichArticles', () => {
	it('runs sentiment analysis on articles with content', async () => {
		const adapter = mockAdapter()
		const articles = [
			{
				id: 'a1',
				title: 'Great product launch',
				content: 'The new product exceeded expectations.',
				brand: 'AcmeCorp',
			},
			{
				id: 'a2',
				title: 'No content article',
				content: null,
				brand: 'AcmeCorp',
			},
		]

		const { results, failedCount } = await enrichArticles(adapter, articles)
		expect(results).toHaveLength(1)
		expect(failedCount).toBe(0)
		expect(results[0].articleId).toBe('a1')
		expect(results[0].sentiment.score).toBe(0.7)
		expect(results[0].sentiment.themes).toContain('innovation')
	})

	it('returns empty for articles without content', async () => {
		const adapter = mockAdapter()
		const articles = [
			{ id: 'a1', title: 'No body', content: null, brand: 'Test' },
		]
		const { results, failedCount } = await enrichArticles(adapter, articles)
		expect(results).toHaveLength(0)
		expect(failedCount).toBe(0)
	})

	it('logs and counts articles where sentiment analysis fails', async () => {
		const adapter: OpenAIAdapter = {
			analyzeSentiment: vi.fn().mockRejectedValue(new Error('LLM error')),
			generateContent: vi.fn(),
		}
		const articles = [
			{ id: 'a1', title: 'Test', content: 'Content here', brand: 'Brand' },
		]
		const { results, failedCount } = await enrichArticles(adapter, articles)
		expect(results).toHaveLength(0)
		expect(failedCount).toBe(1)
	})
})
