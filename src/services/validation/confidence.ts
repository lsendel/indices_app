import { standardDeviation } from '../../utils/math'

interface ConfidenceIntervalResult {
	mean: number
	lower: number
	upper: number
	level: number
}

/** Compute confidence interval using normal approximation */
export function confidenceInterval(values: number[], level = 0.95): ConfidenceIntervalResult {
	const n = values.length
	const mean = values.reduce((a, b) => a + b, 0) / n
	const stdDev = standardDeviation(values)

	// z-value for common confidence levels
	const zMap: Record<number, number> = { 0.9: 1.645, 0.95: 1.96, 0.99: 2.576 }
	const z = zMap[level] ?? 1.96

	const margin = z * (stdDev / Math.sqrt(n))

	return {
		mean,
		lower: mean - margin,
		upper: mean + margin,
		level,
	}
}
