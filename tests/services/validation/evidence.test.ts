import { describe, it, expect } from 'vitest'
import { validateClaim } from '../../../src/services/validation/evidence'
import { confidenceInterval } from '../../../src/services/validation/confidence'

describe('evidence validation', () => {
  it('validates a well-supported claim', () => {
    const result = validateClaim({
      claim: 'Product X is popular',
      supportingEvidence: ['Source A says 80% adoption', 'Source B confirms growth'],
      contradictingEvidence: [],
    })
    expect(result.confidence).toBeGreaterThan(0.5)
    expect(result.verdict).toBe('supported')
  })

  it('flags a claim with strong contradictions', () => {
    const result = validateClaim({
      claim: 'Product X is popular',
      supportingEvidence: ['One blog post'],
      contradictingEvidence: ['Market data shows 5% adoption', 'Survey shows low awareness', 'Competitor dominates'],
    })
    expect(result.confidence).toBeLessThan(0.5)
    expect(result.verdict).toBe('contradicted')
  })

  it('returns insufficient for no evidence', () => {
    const result = validateClaim({
      claim: 'Product X is popular',
      supportingEvidence: [],
      contradictingEvidence: [],
    })
    expect(result.verdict).toBe('insufficient')
  })
})

describe('confidence interval', () => {
  it('computes 95% CI for a sample', () => {
    const values = [10, 12, 11, 13, 9, 14, 10, 11, 12, 13]
    const ci = confidenceInterval(values, 0.95)
    expect(ci.mean).toBeCloseTo(11.5, 0)
    expect(ci.lower).toBeLessThan(ci.mean)
    expect(ci.upper).toBeGreaterThan(ci.mean)
  })
})
