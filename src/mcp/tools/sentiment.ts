import { eq, and, gte } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { sentimentArticles } from '../../db/schema'

export async function handleGetSentimentAnalysis(brand: string, timeframeDays: number, tenantId: string) {
	const db = getDb()
	const since = new Date(Date.now() - timeframeDays * 24 * 60 * 60 * 1000)

	const rows = await db.select().from(sentimentArticles)
		.where(and(eq(sentimentArticles.brand, brand), gte(sentimentArticles.createdAt, since)))

	const scores = rows.map(r => r.sentimentScore)
	const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
	const allThemes = rows.flatMap(r => (r.themes as string[]) ?? [])
	const themeCounts = allThemes.reduce((acc, t) => { acc[t] = (acc[t] ?? 0) + 1; return acc }, {} as Record<string, number>)
	const topThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([theme, count]) => ({ theme, count }))

	return { brand, timeframeDays, averageScore, dataPoints: rows.length, topThemes }
}

export async function handleGetCompetitiveIntel(competitor: string, tenantId: string) {
	const db = getDb()
	const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

	const rows = await db.select().from(sentimentArticles)
		.where(and(eq(sentimentArticles.brand, competitor), gte(sentimentArticles.createdAt, since)))

	const scores = rows.map(r => r.sentimentScore)
	const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

	return { competitor, sentimentData: { averageScore: avgScore, dataPoints: rows.length } }
}
