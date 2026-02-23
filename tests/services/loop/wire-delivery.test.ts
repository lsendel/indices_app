import { describe, it, expect, vi } from 'vitest'
import { createEventBus } from '../../../src/services/loop'
import { createDeliveryWatcher } from '../../../src/services/loop/watchers/delivery'

describe('Delivery → Event Bus wiring', () => {
	it('should emit delivery.completed', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('delivery.completed', handler)

		const watcher = createDeliveryWatcher(bus)
		await watcher.onDeliveryCompleted('tenant-1', {
			campaignId: 'c-1',
			channel: 'email',
			metrics: { sent: 100, delivered: 95, opened: 40, clicked: 15 },
		})

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				payload: expect.objectContaining({ campaignId: 'c-1', channel: 'email' }),
			}),
		)
	})
})
