import { z } from 'zod'
import type { LLMProvider } from '../../adapters/llm/types'
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

const sentimentSchema = z.object({ score: z.number(), themes: z.array(z.string()) })

export async function enrichArticles(
	provider: LLMProvider,
	articles: ArticleForEnrichment[],
): Promise<{ results: EnrichmentResult[]; failedCount: number }> {
	const withContent = articles.filter(a => a.content !== null && a.content.length > 0)
	const results: EnrichmentResult[] = []
	let failedCount = 0
	let lastError = ''

	for (const article of withContent) {
		try {
			const sentiment = await provider.generateJSON(
				`Analyze sentiment about "${article.brand}" in this text:\n\n${article.content!.slice(0, 2000)}`,
				sentimentSchema,
				{ systemPrompt: 'You analyze sentiment. Return JSON: { "score": number (-1 to 1), "themes": string[] }' },
			)
			results.push({ articleId: article.id, sentiment })
		} catch (e) {
			failedCount++
			lastError = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e)
			logger.error('Sentiment analysis failed for article', { articleId: article.id, error: lastError })
		}
	}

	if (failedCount > 0) {
		const failureRate = failedCount / withContent.length
		logger.warn('enrichArticles: partial failure summary', {
			attempted: withContent.length,
			succeeded: results.length,
			failed: failedCount,
			failureRate: `${(failureRate * 100).toFixed(1)}%`,
			lastError,
		})

		if (failedCount === withContent.length) {
			throw new Error(`enrichArticles: all ${failedCount} articles failed enrichment (last error: ${lastError})`)
		}
	}

	return { results, failedCount }
}
