import type { OpenAIAdapter } from '../../adapters/openai'

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

/** Run sentiment analysis on articles that have content. */
export async function enrichArticles(
	adapter: OpenAIAdapter,
	articles: ArticleForEnrichment[],
): Promise<EnrichmentResult[]> {
	const withContent = articles.filter(a => a.content !== null && a.content.length > 0)
	const results: EnrichmentResult[] = []

	for (const article of withContent) {
		try {
			const sentiment = await adapter.analyzeSentiment(article.content!, article.brand)
			results.push({ articleId: article.id, sentiment })
		} catch {
			// Skip articles where analysis fails
		}
	}

	return results
}
