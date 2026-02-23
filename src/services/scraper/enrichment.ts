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
	let failures = 0
	for (const article of articles) {
		if (!article.content) continue
		try {
			const sentiment = await adapter.analyzeSentiment(article.content, article.brand)
			results.push({ articleId: article.id, sentiment })
		} catch (e) {
			failures++
			console.warn('enrichArticles: failed to enrich article', {
				articleId: article.id,
				brand: article.brand,
				error: e instanceof Error ? e.message : String(e),
			})
		}
	}
	const attempted = articles.filter(a => a.content).length
	if (failures > 0 && failures === attempted) {
		throw new Error(`enrichArticles: all ${failures} articles failed enrichment`)
	}
	return results
}
