import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../../../src/services/loop'
import { createEngagementWatcher } from '../../../src/services/loop/watchers/engagement'

describe('Engagement → Event Bus wiring', () => {
	it('should emit engagement.threshold_reached when threshold met', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('engagement.threshold_reached', handler)

		const watcher = createEngagementWatcher(bus)
		await watcher.onEngagementCollected('tenant-1', {
			publishedContentId: 'pc-1',
			channel: 'email',
			score: 150,
			totalEvents: 200,
		})

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				type: 'engagement.threshold_reached',
			}),
		)
	})

	it('should NOT emit threshold event when below threshold', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('engagement.threshold_reached', handler)

		const watcher = createEngagementWatcher(bus)
		await watcher.onEngagementCollected('tenant-1', {
			publishedContentId: 'pc-1',
			channel: 'email',
			score: 30,
			totalEvents: 50,
		})

		expect(handler).not.toHaveBeenCalled()
	})
})
