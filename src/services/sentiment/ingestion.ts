import { createHash } from 'crypto'
import type { BatchPayload } from '../../types/api'

export interface NormalizedArticle {
	tenantId: string
	source: 'rss' | 'reddit' | 'linkedin' | 'instagram' | 'news' | 'web'
	title: string
	content: string | null
	url: string | null
	author: string | null
	contentHash: string
	metadata: Record<string, unknown>
	publishedAt: Date | null
}

/** Normalize a batch from the Rust scraper worker into article records for DB insert */
export function normalizeBatchToArticles(batch: BatchPayload, tenantId: string): NormalizedArticle[] {
	const articles: NormalizedArticle[] = []

	if (batch.pages) {
		for (const page of batch.pages) {
			articles.push({
				tenantId,
				source: 'web',
				title: page.title,
				content: page.content ?? null,
				url: page.url,
				author: page.author ?? null,
				contentHash: page.content_hash ?? hashContent(page.title + (page.content ?? '')),
				metadata: {},
				publishedAt: null,
			})
		}
	}

	if (batch.posts) {
		for (const post of batch.posts) {
			const platform = normalizePlatform(post.platform)
			articles.push({
				tenantId,
				source: platform,
				title: post.title ?? post.content?.slice(0, 100) ?? 'Untitled',
				content: post.content ?? null,
				url: post.url ?? null,
				author: post.author ?? null,
				contentHash: hashContent((post.title ?? '') + (post.content ?? '')),
				metadata: { engagement: post.engagement ?? {} },
				publishedAt: post.posted_at ? new Date(post.posted_at) : null,
			})
		}
	}

	return articles
}

function normalizePlatform(platform: string): NormalizedArticle['source'] {
	const map: Record<string, NormalizedArticle['source']> = {
		reddit: 'reddit',
		linkedin: 'linkedin',
		instagram: 'instagram',
		rss: 'rss',
		news: 'news',
	}
	return map[platform.toLowerCase()] ?? 'web'
}

function hashContent(content: string): string {
	return createHash('sha256').update(content).digest('hex')
}
