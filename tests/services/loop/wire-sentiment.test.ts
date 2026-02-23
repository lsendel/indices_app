import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../../../src/services/loop'
import { createSentimentWatcher } from '../../../src/services/loop/watchers/sentiment'

describe('Sentiment → Event Bus wiring', () => {
	it('should emit sentiment.drift_detected when drift found', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('sentiment.drift_detected', handler)

		const watcher = createSentimentWatcher(bus)
		await watcher.onDriftDetected('tenant-1', {
			brand: 'TestBrand',
			direction: 'negative',
			zScore: 3.2,
			baselineMean: 0.6,
			currentMean: 0.2,
			themes: ['product issues', 'customer service'],
		})

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				payload: expect.objectContaining({ brand: 'TestBrand', direction: 'negative' }),
			}),
		)
	})
})
