import { describe, it, expect } from 'vitest'
import { shouldTriggerOptimization } from '../../../src/services/engagement/optimizer-trigger'

describe('shouldTriggerOptimization', () => {
	it('should trigger when total events exceed threshold', () => {
		const result = shouldTriggerOptimization(150, 100)
		expect(result.triggered).toBe(true)
		expect(result.totalEvents).toBe(150)
		expect(result.threshold).toBe(100)
	})

	it('should trigger when total events equal threshold', () => {
		const result = shouldTriggerOptimization(100, 100)
		expect(result.triggered).toBe(true)
	})

	it('should not trigger below threshold', () => {
		const result = shouldTriggerOptimization(50, 100)
		expect(result.triggered).toBe(false)
		expect(result.totalEvents).toBe(50)
	})

	it('should use default threshold of 100', () => {
		const result = shouldTriggerOptimization(99)
		expect(result.triggered).toBe(false)
		expect(result.threshold).toBe(100)
	})

	it('should trigger with default threshold when events >= 100', () => {
		const result = shouldTriggerOptimization(100)
		expect(result.triggered).toBe(true)
	})
})
