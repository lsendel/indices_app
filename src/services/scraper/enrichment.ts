import type { OpenAIAdapter } from '../../adapters/openai'
import { logger } from '../../utils/logger'

export interface ArticleForEnrichment {
	id: string
	title: string
	content: string | null
	brand: string
}

export interface EnrichmentResult {
	articleId: string
	sentiment: { score: number; themes: string[] }
}

export async function enrichArticles(
	adapter: OpenAIAdapter,
	articles: ArticleForEnrichment[],
): Promise<{ results: EnrichmentResult[]; failedCount: number }> {
	const withContent = articles.filter(a => a.content !== null && a.content.length > 0)
	const results: EnrichmentResult[] = []
	let failedCount = 0
	let lastError = ''

	for (const article of withContent) {
		try {
			const sentiment = await adapter.analyzeSentiment(article.content!, article.brand)
			results.push({ articleId: article.id, sentiment })
		} catch (e) {
			failedCount++
			lastError = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e)
			logger.error({ articleId: article.id, error: lastError }, 'Sentiment analysis failed for article')
		}
	}

	if (failedCount > 0) {
		const failureRate = failedCount / withContent.length
		logger.warn({
			attempted: withContent.length,
			succeeded: results.length,
			failed: failedCount,
			failureRate: `${(failureRate * 100).toFixed(1)}%`,
			lastError,
		}, 'enrichArticles: partial failure summary')

		if (failedCount === withContent.length) {
			throw new Error(`enrichArticles: all ${failedCount} articles failed enrichment (last error: ${lastError})`)
		}
	}

	return { results, failedCount }
}
