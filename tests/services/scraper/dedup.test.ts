import { describe, it, expect } from 'vitest'
import { hashContent, deduplicateArticles } from '../../../src/services/scraper/dedup'
import type { NormalizedArticle } from '../../../src/services/sentiment/ingestion'

describe('hashContent', () => {
	it('produces a consistent SHA-256 hex hash', () => {
		const hash1 = hashContent('hello world')
		const hash2 = hashContent('hello world')
		expect(hash1).toBe(hash2)
		expect(hash1).toHaveLength(64)
	})

	it('produces different hashes for different content', () => {
		expect(hashContent('a')).not.toBe(hashContent('b'))
	})
})

describe('deduplicateArticles', () => {
	const makeArticle = (title: string, hash: string): NormalizedArticle => ({
		tenantId: 't1',
		source: 'web',
		title,
		content: null,
		url: null,
		author: null,
		contentHash: hash,
		metadata: {},
		publishedAt: null,
	})

	it('removes duplicates within the batch by contentHash', () => {
		const articles = [
			makeArticle('First', 'hash-a'),
			makeArticle('Duplicate', 'hash-a'),
			makeArticle('Second', 'hash-b'),
		]
		const result = deduplicateArticles(articles)
		expect(result).toHaveLength(2)
		expect(result.map(a => a.title)).toEqual(['First', 'Second'])
	})

	it('removes articles whose hashes exist in the known set', () => {
		const articles = [
			makeArticle('New', 'hash-new'),
			makeArticle('Existing', 'hash-existing'),
		]
		const existingHashes = new Set(['hash-existing'])
		const result = deduplicateArticles(articles, existingHashes)
		expect(result).toHaveLength(1)
		expect(result[0].title).toBe('New')
	})

	it('returns empty for all duplicates', () => {
		const articles = [
			makeArticle('A', 'hash-x'),
			makeArticle('B', 'hash-x'),
		]
		const existingHashes = new Set(['hash-x'])
		expect(deduplicateArticles(articles, existingHashes)).toHaveLength(0)
	})

	it('preserves order (keeps first occurrence)', () => {
		const articles = [
			makeArticle('Z', 'hash-1'),
			makeArticle('A', 'hash-2'),
			makeArticle('M', 'hash-3'),
		]
		const result = deduplicateArticles(articles)
		expect(result.map(a => a.title)).toEqual(['Z', 'A', 'M'])
	})
})
