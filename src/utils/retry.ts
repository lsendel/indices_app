export interface RetryOptions {
	maxRetries?: number
	baseDelayMs?: number
	maxDelayMs?: number
	shouldRetry?: (error: unknown) => boolean
}

export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const {
		maxRetries = 3,
		baseDelayMs = 500,
		maxDelayMs = 10000,
		shouldRetry = () => true,
	} = options

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn()
		} catch (error) {
			if (attempt === maxRetries || !shouldRetry(error)) throw error
			const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs)
			const jitter = delay * (0.5 + Math.random() * 0.5)
			await new Promise((resolve) => setTimeout(resolve, jitter))
		}
	}

	throw new Error('Unreachable')
}
