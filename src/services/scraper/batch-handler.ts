import { inArray, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { scrapedArticles, scrapedSocial, scrapeJobs } from '../../db/schema'
import { normalizeBatchToArticles } from '../sentiment/ingestion'
import { deduplicateArticles } from './dedup'
import { logger } from '../../utils/logger'
import type { BatchPayload } from '../../types/api'

export type { BatchPayload }

export interface BatchResult {
	jobId: string
	batchIndex: number
	processed: number
	deduplicated: number
	isFinal: boolean
}

export async function processBatch(batch: BatchPayload, tenantId: string): Promise<BatchResult> {
	const db = getDb()
	const normalized = normalizeBatchToArticles(batch, tenantId)

	if (normalized.length === 0) {
		return { jobId: batch.job_id, batchIndex: batch.batch_index, processed: 0, deduplicated: 0, isFinal: batch.is_final }
	}

	const hashes = normalized.map(a => a.contentHash)
	const existingArticles = await db.select({ contentHash: scrapedArticles.contentHash }).from(scrapedArticles).where(inArray(scrapedArticles.contentHash, hashes))
	const existingSocial = await db.select({ contentHash: scrapedSocial.contentHash }).from(scrapedSocial).where(inArray(scrapedSocial.contentHash, hashes))
	const existingHashes = new Set([...existingArticles.map(a => a.contentHash), ...existingSocial.map(s => s.contentHash)])

	const unique = deduplicateArticles(normalized, existingHashes)
	const deduplicated = normalized.length - unique.length

	const webArticles = unique.filter(a => ['web', 'rss', 'news'].includes(a.source))
	const socialPosts = unique.filter(a => ['reddit', 'linkedin', 'instagram'].includes(a.source))

	try {
		if (webArticles.length > 0) {
			await db.insert(scrapedArticles).values(webArticles.map(a => ({
				tenantId: a.tenantId, source: a.source as 'rss' | 'news' | 'web', title: a.title,
				content: a.content, url: a.url ?? '', author: a.author, contentHash: a.contentHash,
				metadata: a.metadata, publishedAt: a.publishedAt,
			})))
		}

		if (socialPosts.length > 0) {
			await db.insert(scrapedSocial).values(socialPosts.map(a => ({
				tenantId: a.tenantId, platform: a.source as 'reddit' | 'linkedin' | 'instagram',
				title: a.title, content: a.content, url: a.url, author: a.author,
				contentHash: a.contentHash, engagement: (a.metadata as Record<string, unknown>).engagement ?? {},
				metadata: a.metadata, postedAt: a.publishedAt,
			})))
		}

		if (batch.is_final) {
			await db.update(scrapeJobs).set({ status: 'completed', completedAt: new Date() }).where(eq(scrapeJobs.id, batch.job_id))
		}
	} catch (err) {
		logger.error({ jobId: batch.job_id, batchIndex: batch.batch_index, error: err }, 'Failed to persist batch content')
		throw err
	}

	return { jobId: batch.job_id, batchIndex: batch.batch_index, processed: unique.length, deduplicated, isFinal: batch.is_final }
}
