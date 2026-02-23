import { describe, it, expect, vi } from 'vitest'
import { createEventBus, type LoopEvent } from '../../../src/services/loop/event-bus'

describe('EventBus', () => {
	it('should emit and receive typed events', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('engagement.collected', handler)

		await bus.emit('tenant-1', 'engagement.collected', { channel: 'email', score: 42 })

		expect(handler).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				type: 'engagement.collected',
				payload: { channel: 'email', score: 42 },
			}),
		)
	})

	it('should not cross tenant boundaries', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.on('engagement.collected', handler)

		await bus.emit('tenant-1', 'engagement.collected', { channel: 'email', score: 10 })
		await bus.emit('tenant-2', 'engagement.collected', { channel: 'sms', score: 20 })

		expect(handler).toHaveBeenCalledTimes(2)
		expect(handler.mock.calls[0][0].tenantId).toBe('tenant-1')
		expect(handler.mock.calls[1][0].tenantId).toBe('tenant-2')
	})

	it('should support wildcard handlers', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		bus.onAny(handler)

		await bus.emit('tenant-1', 'engagement.collected', {})
		await bus.emit('tenant-1', 'sentiment.drift_detected', {})

		expect(handler).toHaveBeenCalledTimes(2)
	})

	it('should catch handler errors without breaking other handlers', async () => {
		const bus = createEventBus()
		const badHandler = vi.fn().mockRejectedValue(new Error('boom'))
		const goodHandler = vi.fn()
		bus.on('engagement.collected', badHandler)
		bus.on('engagement.collected', goodHandler)

		await bus.emit('tenant-1', 'engagement.collected', {})

		expect(badHandler).toHaveBeenCalled()
		expect(goodHandler).toHaveBeenCalled()
	})

	it('should return event history', async () => {
		const bus = createEventBus()
		await bus.emit('tenant-1', 'engagement.collected', { score: 1 })
		await bus.emit('tenant-1', 'engagement.collected', { score: 2 })
		await bus.emit('tenant-2', 'engagement.collected', { score: 3 })

		const history = bus.history('tenant-1', 'engagement.collected')
		expect(history).toHaveLength(2)
		expect(history[0].payload.score).toBe(1)
	})

	it('should bound event log to maxLogSize', async () => {
		const bus = createEventBus({ maxLogSize: 5 })
		for (let i = 0; i < 10; i++) {
			await bus.emit('tenant-1', 'engagement.collected', { i })
		}

		const history = bus.history('tenant-1', 'engagement.collected')
		expect(history).toHaveLength(5)
		expect(history[0].payload.i).toBe(5)
	})

	it('should allow unsubscribing typed handlers via off()', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		const off = bus.on('engagement.collected', handler)

		await bus.emit('tenant-1', 'engagement.collected', {})
		expect(handler).toHaveBeenCalledTimes(1)

		off()
		await bus.emit('tenant-1', 'engagement.collected', {})
		expect(handler).toHaveBeenCalledTimes(1)
	})

	it('should allow unsubscribing wildcard handlers via off()', async () => {
		const bus = createEventBus()
		const handler = vi.fn()
		const off = bus.onAny(handler)

		await bus.emit('tenant-1', 'engagement.collected', {})
		expect(handler).toHaveBeenCalledTimes(1)

		off()
		await bus.emit('tenant-1', 'engagement.collected', {})
		expect(handler).toHaveBeenCalledTimes(1)
	})
})
