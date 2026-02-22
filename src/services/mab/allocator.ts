import type { ArmState } from './thompson'

/**
 * Allocate traffic proportionally based on arm strength.
 * Uses expected value of Beta distribution: alpha / (alpha + beta)
 * Returns array of fractions summing to 1.0
 */
export function allocateTraffic(arms: ArmState[]): number[] {
	const expectations = arms.map((a) => a.alpha / (a.alpha + a.beta))
	const total = expectations.reduce((a, b) => a + b, 0)
	return expectations.map((e) => e / total)
}
