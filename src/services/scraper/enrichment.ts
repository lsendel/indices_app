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

export async function enrichArticles(adapter: OpenAIAdapter, articles: ArticleForEnrichment[]): Promise<EnrichmentResult[]> {
	const results: EnrichmentResult[] = []
	for (const article of articles) {
		if (!article.content) continue
		try {
			const sentiment = await adapter.analyzeSentiment(article.content, article.brand)
			results.push({ articleId: article.id, sentiment })
		} catch { /* skip failures */ }
	}
	return results
}
