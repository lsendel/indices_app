import { describe, it, expect } from 'vitest'
import { selectArm, updateArm } from '../../../src/services/mab/thompson'
import { allocateTraffic } from '../../../src/services/mab/allocator'

describe('Thompson Sampling', () => {
  it('selects the arm with highest sampled value', () => {
    // Arm 0 has much higher alpha (successes), should be selected most often
    const arms = [
      { alpha: 100, beta: 1 },
      { alpha: 1, beta: 100 },
    ]
    const counts = [0, 0]
    for (let i = 0; i < 100; i++) {
      const idx = selectArm(arms)
      counts[idx]++
    }
    expect(counts[0]).toBeGreaterThan(90) // Arm 0 should win almost always
  })

  it('updateArm increments alpha on success', () => {
    const arm = { alpha: 1, beta: 1 }
    const updated = updateArm(arm, true)
    expect(updated.alpha).toBe(2)
    expect(updated.beta).toBe(1)
  })

  it('updateArm increments beta on failure', () => {
    const arm = { alpha: 1, beta: 1 }
    const updated = updateArm(arm, false)
    expect(updated.alpha).toBe(1)
    expect(updated.beta).toBe(2)
  })
})

describe('traffic allocator', () => {
  it('allocates traffic proportionally to arm strength', () => {
    const arms = [
      { alpha: 50, beta: 10 }, // strong
      { alpha: 10, beta: 50 }, // weak
      { alpha: 5, beta: 5 },   // uncertain
    ]
    const allocation = allocateTraffic(arms)
    expect(allocation).toHaveLength(3)
    expect(allocation[0]).toBeGreaterThan(allocation[1]) // strong > weak
    expect(allocation.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5) // sums to 1
  })
})
