/** Calculate z-score: how many standard deviations a value is from the mean */
export function zScore(value: number, mean: number, stdDev: number): number {
	if (stdDev === 0) return 0
	return (value - mean) / stdDev
}

/** Calculate standard deviation of a number array */
export function standardDeviation(values: number[]): number {
	if (values.length <= 1) return 0
	const mean = values.reduce((a, b) => a + b, 0) / values.length
	const squareDiffs = values.map((v) => (v - mean) ** 2)
	return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length)
}

/** Compute moving average with given window size */
export function movingAverage(values: number[], window: number): number[] {
	if (values.length < window) return []
	const result: number[] = []
	for (let i = 0; i <= values.length - window; i++) {
		const slice = values.slice(i, i + window)
		result.push(slice.reduce((a, b) => a + b, 0) / window)
	}
	return result
}

/**
 * Sample from a Beta distribution using the gamma function approach.
 * Used for Thompson Sampling in MAB experiments.
 * alpha = successes + 1, beta = failures + 1
 */
export function betaSample(alpha: number, beta: number): number {
	const gammaA = gammaSample(alpha)
	const gammaB = gammaSample(beta)
	return gammaA / (gammaA + gammaB)
}

/** Sample from Gamma(shape, 1) using Marsaglia and Tsang's method */
function gammaSample(shape: number): number {
	if (shape < 1) {
		return gammaSample(shape + 1) * Math.random() ** (1 / shape)
	}
	const d = shape - 1 / 3
	const c = 1 / Math.sqrt(9 * d)
	for (;;) {
		let x: number
		let v: number
		do {
			x = randn()
			v = 1 + c * x
		} while (v <= 0)
		v = v * v * v
		const u = Math.random()
		if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v
		if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
	}
}

/** Standard normal sample via Box-Muller */
function randn(): number {
	const u1 = Math.random()
	const u2 = Math.random()
	return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}
