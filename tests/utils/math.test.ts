import { describe, it, expect } from 'vitest'
import { zScore, movingAverage, betaSample, standardDeviation } from '../../src/utils/math'

describe('math utilities', () => {
  describe('zScore', () => {
    it('returns 0 for value equal to mean', () => {
      expect(zScore(5, 5, 1)).toBe(0)
    })

    it('returns positive z-score for value above mean', () => {
      expect(zScore(7, 5, 1)).toBe(2)
    })

    it('returns negative z-score for value below mean', () => {
      expect(zScore(3, 5, 1)).toBe(-2)
    })

    it('returns 0 when stdDev is 0', () => {
      expect(zScore(7, 5, 0)).toBe(0)
    })
  })

  describe('movingAverage', () => {
    it('computes moving average for window', () => {
      const values = [1, 2, 3, 4, 5]
      const result = movingAverage(values, 3)
      expect(result).toEqual([2, 3, 4])
    })

    it('returns empty for window larger than data', () => {
      expect(movingAverage([1, 2], 5)).toEqual([])
    })
  })

  describe('standardDeviation', () => {
    it('computes standard deviation', () => {
      const result = standardDeviation([2, 4, 4, 4, 5, 5, 7, 9])
      expect(result).toBeCloseTo(2.0, 1)
    })

    it('returns 0 for single value', () => {
      expect(standardDeviation([5])).toBe(0)
    })
  })

  describe('betaSample', () => {
    it('returns value between 0 and 1', () => {
      const sample = betaSample(10, 5)
      expect(sample).toBeGreaterThanOrEqual(0)
      expect(sample).toBeLessThanOrEqual(1)
    })

    it('with high alpha, tends toward higher values', () => {
      const samples = Array.from({ length: 100 }, () => betaSample(100, 1))
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length
      expect(mean).toBeGreaterThan(0.9)
    })
  })
})
