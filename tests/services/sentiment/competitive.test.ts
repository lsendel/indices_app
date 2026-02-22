import { describe, it, expect } from 'vitest'
import { calculateShareOfVoice, compareBrands } from '../../../src/services/sentiment/competitive'

describe('competitive benchmarking', () => {
  const articles = [
    { brand: 'Apple', sentimentScore: 0.5 },
    { brand: 'Apple', sentimentScore: 0.3 },
    { brand: 'Apple', sentimentScore: 0.8 },
    { brand: 'Samsung', sentimentScore: -0.2 },
    { brand: 'Samsung', sentimentScore: 0.1 },
    { brand: 'Google', sentimentScore: 0.4 },
  ]

  it('calculates share of voice per brand', () => {
    const sov = calculateShareOfVoice(articles)
    expect(sov.Apple).toBeCloseTo(0.5, 1) // 3/6
    expect(sov.Samsung).toBeCloseTo(0.333, 1) // 2/6
    expect(sov.Google).toBeCloseTo(0.167, 1) // 1/6
  })

  it('compares brand sentiment averages', () => {
    const comparison = compareBrands(articles)
    expect(comparison.Apple.avgSentiment).toBeCloseTo(0.533, 1)
    expect(comparison.Samsung.avgSentiment).toBeCloseTo(-0.05, 1)
    expect(comparison.Apple.articleCount).toBe(3)
  })
})
