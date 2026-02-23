import { describe, it, expect, vi } from 'vitest'
import { withRetry } from '../../src/utils/retry'

describe('withRetry', () => {
	it('returns result on first success', async () => {
		const fn = vi.fn().mockResolvedValue('ok')
		const result = await withRetry(fn)
		expect(result).toBe('ok')
		expect(fn).toHaveBeenCalledTimes(1)
	})

	it('retries on failure then succeeds', async () => {
		const fn = vi
			.fn()
			.mockRejectedValueOnce(new Error('fail1'))
			.mockRejectedValueOnce(new Error('fail2'))
			.mockResolvedValue('ok')

		const result = await withRetry(fn, { baseDelayMs: 1, maxRetries: 3 })
		expect(result).toBe('ok')
		expect(fn).toHaveBeenCalledTimes(3)
	})

	it('throws after max retries exhausted', async () => {
		const fn = vi.fn().mockRejectedValue(new Error('always fails'))

		await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 1 })).rejects.toThrow('always fails')
		expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
	})

	it('respects shouldRetry predicate', async () => {
		const fn = vi.fn().mockRejectedValue(new Error('permanent'))
		const shouldRetry = vi.fn().mockReturnValue(false)

		await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 1, shouldRetry })).rejects.toThrow(
			'permanent',
		)
		expect(fn).toHaveBeenCalledTimes(1)
	})
})
