import { describe, it, expect } from 'vitest'
import { detectDrift, classifySentiment } from '../../../src/services/sentiment/analyzer'
import { extractThemes } from '../../../src/services/sentiment/themes'

describe('sentiment analyzer', () => {
  describe('classifySentiment', () => {
    it('classifies positive score', () => {
      expect(classifySentiment(0.6)).toBe('positive')
    })

    it('classifies negative score', () => {
      expect(classifySentiment(-0.4)).toBe('negative')
    })

    it('classifies neutral score', () => {
      expect(classifySentiment(0.05)).toBe('neutral')
    })
  })

  describe('detectDrift', () => {
    it('detects positive drift when z-score exceeds threshold', () => {
      const baseline = [-0.1, 0.0, 0.1, -0.05, 0.05, 0.0, -0.1]
      const current = [0.5, 0.6, 0.55, 0.7, 0.65]
      const result = detectDrift(baseline, current, 2.0)
      expect(result).not.toBeNull()
      expect(result!.direction).toBe('positive')
      expect(Math.abs(result!.zScore)).toBeGreaterThan(2.0)
    })

    it('returns null when no significant drift', () => {
      const baseline = [0.1, 0.0, 0.1, -0.05, 0.05]
      const current = [0.08, 0.12, 0.0, 0.05]
      const result = detectDrift(baseline, current, 2.0)
      expect(result).toBeNull()
    })
  })
})

describe('theme extraction', () => {
  it('matches known theme patterns', () => {
    const text = 'The product launch was a massive success with innovative features'
    const themes = extractThemes(text)
    expect(themes).toContain('Product Launch')
  })

  it('returns empty for unrelated content', () => {
    const themes = extractThemes('The weather is nice today')
    expect(themes.length).toBe(0)
  })
})
