import { Hono } from 'hono'
import { eq, and, gte, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { verifySignature } from '../services/scraper/dispatcher'
import { processBatch } from '../services/scraper/batch-handler'
import { enrichArticles, type ArticleForEnrichment } from '../services/scraper/enrichment'
import { classifySentiment, detectDrift } from '../services/sentiment/analyzer'
import { extractThemes } from '../services/sentiment/themes'
import { sentimentArticles, driftEvents, scrapedArticles } from '../db/schema'
import { createLLMRouterFromConfig } from '../adapters/llm/factory'
import { batchPayload } from '../types/api'
import { logger } from '../utils/logger'

export function createIngestRoutes() {
	const router = new Hono<AppEnv>()

	router.post('/batch', async (c) => {
		const secret = c.env.SCRAPER_SHARED_SECRET || 'dev-secret'
		const signature = c.req.header('x-signature')
		const timestamp = c.req.header('x-timestamp')
		const body = await c.req.text()

		if (!signature || !timestamp) {
			return c.json({ error: 'Missing HMAC headers' }, 401)
		}

		const ts = Number(timestamp)
		if (!Number.isFinite(ts)) {
			return c.json({ error: 'Invalid timestamp' }, 401)
		}

		const now = Math.floor(Date.now() / 1000)
		if (Math.abs(now - ts) > 300) {
			return c.json({ error: 'Timestamp too old' }, 401)
		}

		if (!verifySignature(body, timestamp, signature, secret)) {
			return c.json({ error: 'Invalid signature' }, 401)
		}

		let parsed: unknown
		try {
			parsed = JSON.parse(body)
		} catch {
			return c.json({ error: 'Invalid JSON body' }, 400)
		}

		const validation = batchPayload.safeParse(parsed)
		if (!validation.success) {
			logger.warn('Invalid batch payload', { errors: validation.error.flatten() })
			return c.json({ error: 'Invalid batch payload', details: validation.error.flatten() }, 422)
		}

		const payload = validation.data
		const tenantId = payload.tenant_id
		if (!tenantId) {
			return c.json({ error: 'Missing tenant_id in payload' }, 400)
		}

		const result = await processBatch(c.var.db, payload, tenantId)

		// Sentiment enrichment — runs if an LLM provider is available
		let enriched = 0
		if (result.processed > 0) {
			try {
				enriched = await runSentimentEnrichment(c, tenantId)
			} catch (err) {
				logger.warn('Sentiment enrichment failed (non-blocking)', { error: String(err) })
			}
		}

		return c.json({ ...result, enriched })
	})

	return router
}

async function runSentimentEnrichment(c: any, tenantId: string): Promise<number> {
	const db = c.var.db
	const env = c.env
	const loopSystem = c.var.loopSystem

	// Try to create an LLM provider for sentiment analysis
	let provider
	try {
		const config = {
			OPENAI_API_KEY: env.OPENAI_API_KEY,
			OPENAI_MODEL: env.OPENAI_MODEL || 'gpt-4o-mini',
			ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
			GEMINI_API_KEY: env.GEMINI_API_KEY,
			PERPLEXITY_API_KEY: env.PERPLEXITY_API_KEY,
			GROK_API_KEY: env.GROK_API_KEY,
			HUGGINGFACE_API_KEY: env.HUGGINGFACE_API_KEY,
		} as any
		const llmRouter = createLLMRouterFromConfig(config)
		provider = llmRouter.resolve('analysis:sentiment')
	} catch {
		logger.info('No LLM provider available for sentiment enrichment, using keyword-based fallback')
		return runKeywordEnrichment(db, tenantId, loopSystem)
	}

	// Find recent unenriched articles (articles not yet in sentimentArticles)
	const recentArticles = await db
		.select()
		.from(scrapedArticles)
		.where(eq(scrapedArticles.tenantId, tenantId))
		.orderBy(desc(scrapedArticles.createdAt))
		.limit(20)

	if (recentArticles.length === 0) return 0

	// Use LLM enrichment
	const brand = 'default' // In production, resolve from tenant settings
	const articlesForEnrichment: ArticleForEnrichment[] = recentArticles.map((a: any) => ({
		id: a.id,
		title: a.title,
		content: a.content,
		brand,
	}))

	const { results } = await enrichArticles(provider, articlesForEnrichment)

	// Store sentiment results
	for (const r of results) {
		const article = recentArticles.find((a: any) => a.id === r.articleId)
		if (!article) continue

		await db.insert(sentimentArticles).values({
			tenantId,
			source: (article as any).source ?? 'web',
			title: (article as any).title,
			content: (article as any).content,
			url: (article as any).url,
			author: (article as any).author,
			brand,
			sentimentScore: r.sentiment.score,
			sentimentLabel: classifySentiment(r.sentiment.score),
			themes: r.sentiment.themes,
		})
	}

	// Check for drift
	await checkAndEmitDrift(db, tenantId, brand, loopSystem)

	return results.length
}

/** Fallback: keyword-based sentiment scoring when no LLM is available */
async function runKeywordEnrichment(db: any, tenantId: string, loopSystem: any): Promise<number> {
	const recentArticles = await db
		.select()
		.from(scrapedArticles)
		.where(eq(scrapedArticles.tenantId, tenantId))
		.orderBy(desc(scrapedArticles.createdAt))
		.limit(20)

	if (recentArticles.length === 0) return 0

	const brand = 'default'
	let enriched = 0

	for (const article of recentArticles) {
		const text = `${(article as any).title} ${(article as any).content ?? ''}`
		const themes = extractThemes(text)
		// Simple keyword-based score: negative keywords = -0.3, positive = +0.3, neutral = 0
		const hasNeg = themes.some((t: string) => ['Issues', 'Customer Issues'].includes(t))
		const hasPos = themes.some((t: string) => ['Innovation', 'Product Launch'].includes(t))
		const score = hasNeg ? -0.3 : hasPos ? 0.3 : 0

		await db.insert(sentimentArticles).values({
			tenantId,
			source: (article as any).source ?? 'web',
			title: (article as any).title,
			content: (article as any).content,
			url: (article as any).url,
			author: (article as any).author,
			brand,
			sentimentScore: score,
			sentimentLabel: classifySentiment(score),
			themes,
		})
		enriched++
	}

	await checkAndEmitDrift(db, tenantId, brand, loopSystem)
	return enriched
}

/** Check for sentiment drift and emit event if detected */
async function checkAndEmitDrift(db: any, tenantId: string, brand: string, loopSystem: any) {
	const now = new Date()
	const baselineStart = new Date(now.getTime() - 28 * 86_400_000)
	const currentStart = new Date(now.getTime() - 7 * 86_400_000)

	const allScores = await db
		.select({ sentimentScore: sentimentArticles.sentimentScore, analyzedAt: sentimentArticles.analyzedAt })
		.from(sentimentArticles)
		.where(
			and(
				eq(sentimentArticles.tenantId, tenantId),
				eq(sentimentArticles.brand, brand),
				gte(sentimentArticles.analyzedAt, baselineStart),
			),
		)

	const baseline = allScores
		.filter((s: any) => new Date(s.analyzedAt) < currentStart)
		.map((s: any) => s.sentimentScore)
	const current = allScores
		.filter((s: any) => new Date(s.analyzedAt) >= currentStart)
		.map((s: any) => s.sentimentScore)

	const drift = detectDrift(baseline, current)
	if (!drift) return

	// Store drift event
	await db.insert(driftEvents).values({
		tenantId,
		brand,
		zScore: drift.zScore,
		direction: drift.direction,
		baselineMean: drift.baselineMean,
		currentMean: drift.currentMean,
		triggerArticles: [],
		windowStart: currentStart,
		windowEnd: now,
	})

	// Emit to loop system
	if (loopSystem) {
		await loopSystem.watchers.sentiment.onDriftDetected(tenantId, {
			brand,
			direction: drift.direction,
			zScore: drift.zScore,
			baselineMean: drift.baselineMean,
			currentMean: drift.currentMean,
			themes: [],
		})
	}
}
