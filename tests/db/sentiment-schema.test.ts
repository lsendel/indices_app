import { describe, it, expect } from 'vitest'
import { sentimentArticles, driftEvents } from '../../src/db/schema/sentiment'
import { scrapedArticles, scrapedSocial, scrapeJobs } from '../../src/db/schema/scraped-content'

describe('sentiment schema', () => {
  it('sentimentArticles has required columns', () => {
    expect(sentimentArticles.id).toBeDefined()
    expect(sentimentArticles.tenantId).toBeDefined()
    expect(sentimentArticles.source).toBeDefined()
    expect(sentimentArticles.title).toBeDefined()
    expect(sentimentArticles.sentimentScore).toBeDefined()
    expect(sentimentArticles.brand).toBeDefined()
    expect(sentimentArticles.themes).toBeDefined()
  })

  it('driftEvents has z-score and direction', () => {
    expect(driftEvents.id).toBeDefined()
    expect(driftEvents.tenantId).toBeDefined()
    expect(driftEvents.brand).toBeDefined()
    expect(driftEvents.zScore).toBeDefined()
    expect(driftEvents.direction).toBeDefined()
    expect(driftEvents.triggerArticles).toBeDefined()
  })
})

describe('scraped content schema', () => {
  it('scrapedArticles has source and contentHash', () => {
    expect(scrapedArticles.id).toBeDefined()
    expect(scrapedArticles.source).toBeDefined()
    expect(scrapedArticles.contentHash).toBeDefined()
  })

  it('scrapedSocial has platform and engagement', () => {
    expect(scrapedSocial.id).toBeDefined()
    expect(scrapedSocial.platform).toBeDefined()
    expect(scrapedSocial.engagement).toBeDefined()
  })

  it('scrapeJobs tracks dispatch to Rust worker', () => {
    expect(scrapeJobs.id).toBeDefined()
    expect(scrapeJobs.jobType).toBeDefined()
    expect(scrapeJobs.status).toBeDefined()
    expect(scrapeJobs.callbackUrl).toBeDefined()
  })
})
