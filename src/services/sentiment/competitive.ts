interface ArticleData {
	brand: string
	sentimentScore: number
}

interface BrandStats {
	avgSentiment: number
	articleCount: number
	positiveCount: number
	negativeCount: number
	neutralCount: number
}

/** Calculate share of voice: percentage of total articles per brand */
export function calculateShareOfVoice(articles: ArticleData[]): Record<string, number> {
	const counts: Record<string, number> = {}
	for (const a of articles) {
		counts[a.brand] = (counts[a.brand] ?? 0) + 1
	}
	const total = articles.length
	const result: Record<string, number> = {}
	for (const [brand, count] of Object.entries(counts)) {
		result[brand] = count / total
	}
	return result
}

/** Compare sentiment statistics across brands */
export function compareBrands(articles: ArticleData[]): Record<string, BrandStats> {
	const grouped: Record<string, number[]> = {}
	for (const a of articles) {
		if (!grouped[a.brand]) grouped[a.brand] = []
		grouped[a.brand].push(a.sentimentScore)
	}

	const result: Record<string, BrandStats> = {}
	for (const [brand, scores] of Object.entries(grouped)) {
		const avg = scores.reduce((a, b) => a + b, 0) / scores.length
		result[brand] = {
			avgSentiment: avg,
			articleCount: scores.length,
			positiveCount: scores.filter((s) => s > 0.1).length,
			negativeCount: scores.filter((s) => s < -0.1).length,
			neutralCount: scores.filter((s) => s >= -0.1 && s <= 0.1).length,
		}
	}
	return result
}
