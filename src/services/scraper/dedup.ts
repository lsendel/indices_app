import { createHash } from 'crypto'
import type { NormalizedArticle } from '../sentiment/ingestion'

/** Produce a SHA-256 hex hash for deduplication. */
export function hashContent(content: string): string {
	return createHash('sha256').update(content).digest('hex')
}

/** Remove duplicates within the batch and against a set of known hashes. */
export function deduplicateArticles(
	articles: NormalizedArticle[],
	existingHashes?: Set<string>,
): NormalizedArticle[] {
	const seen = new Set(existingHashes ?? [])
	const unique: NormalizedArticle[] = []

	for (const article of articles) {
		if (seen.has(article.contentHash)) continue
		seen.add(article.contentHash)
		unique.push(article)
	}

	return unique
}
