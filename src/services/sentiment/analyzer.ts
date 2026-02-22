import { zScore, standardDeviation } from '../../utils/math'

export type SentimentLabel = 'positive' | 'neutral' | 'negative'

export interface DriftResult {
	zScore: number
	direction: 'positive' | 'negative'
	baselineMean: number
	currentMean: number
}

/** Classify a sentiment score (-1.0 to 1.0) into a label */
export function classifySentiment(score: number): SentimentLabel {
	if (score > 0.1) return 'positive'
	if (score < -0.1) return 'negative'
	return 'neutral'
}

/**
 * Detect sentiment drift between a baseline window and a current window.
 * Returns a DriftResult if the z-score exceeds the threshold, null otherwise.
 */
export function detectDrift(
	baselineScores: number[],
	currentScores: number[],
	threshold = 2.0,
): DriftResult | null {
	if (baselineScores.length < 2 || currentScores.length < 1) return null

	const baselineMean = baselineScores.reduce((a, b) => a + b, 0) / baselineScores.length
	const baselineStdDev = standardDeviation(baselineScores)
	const currentMean = currentScores.reduce((a, b) => a + b, 0) / currentScores.length

	const z = zScore(currentMean, baselineMean, baselineStdDev)

	if (Math.abs(z) < threshold) return null

	return {
		zScore: z,
		direction: z > 0 ? 'positive' : 'negative',
		baselineMean,
		currentMean,
	}
}
