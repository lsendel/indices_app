import { describe, it, expect } from 'vitest'
import { normalizeBatchToArticles } from '../../../src/services/sentiment/ingestion'

describe('sentiment ingestion', () => {
  it('normalizes a social batch into article records', () => {
    const batch = {
      job_id: 'test-job',
      batch_index: 0,
      is_final: false,
      posts: [
        {
          platform: 'reddit',
          title: 'Great new product launch',
          content: 'The innovative product launch was amazing',
          author: 'user123',
          url: 'https://reddit.com/r/test/1',
          engagement: { score: 150, comments: 20 },
          posted_at: '2026-02-20T10:00:00Z',
        },
      ],
    }

    const articles = normalizeBatchToArticles(batch, 'tenant-1')
    expect(articles).toHaveLength(1)
    expect(articles[0].source).toBe('reddit')
    expect(articles[0].tenantId).toBe('tenant-1')
    expect(articles[0].title).toBe('Great new product launch')
  })

  it('normalizes an RSS batch into article records', () => {
    const batch = {
      job_id: 'test-job',
      batch_index: 0,
      is_final: true,
      pages: [
        {
          url: 'https://news.example.com/article-1',
          title: 'Market Report Q1',
          content: 'Revenue growth continues...',
          author: 'Editor',
          content_hash: 'abc123',
        },
      ],
    }

    const articles = normalizeBatchToArticles(batch, 'tenant-1')
    expect(articles).toHaveLength(1)
    expect(articles[0].source).toBe('web')
    expect(articles[0].url).toBe('https://news.example.com/article-1')
  })

  it('returns empty array for empty batch', () => {
    const batch = { job_id: 'test', batch_index: 0, is_final: true }
    const articles = normalizeBatchToArticles(batch, 'tenant-1')
    expect(articles).toEqual([])
  })
})
