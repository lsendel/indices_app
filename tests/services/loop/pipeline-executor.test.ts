import { describe, it, expect, vi } from 'vitest'
import { createPipelineExecutor } from '../../../src/services/loop/pipeline-executor'
import { createEventBus } from '../../../src/services/loop/event-bus'
import type { Rule } from '../../../src/services/loop/rule-engine'

describe('Pipeline Executor', () => {
	it('should execute pipeline action when event matches', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		executor.register({
			name: 'test-pipeline',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [],
			getContext: async () => ({}),
		})

		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })
		expect(action).toHaveBeenCalled()
	})

	it('should skip pipeline when gated by rule', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		const gateRule: Rule = {
			id: 'r1', name: 'gate', priority: 1, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
			actions: [{ type: 'gate' }],
			scope: {},
		}

		executor.register({
			name: 'test-pipeline',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [gateRule],
			getContext: async () => ({}),
		})

		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })
		expect(action).not.toHaveBeenCalled()
	})

	it('should pass merged config overrides to action', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		const rule: Rule = {
			id: 'r1', name: 'boost', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'eq', value: 'email' }],
			actions: [{ type: 'modify', set: { strategy: 'textgrad' } }],
			scope: {},
		}

		executor.register({
			name: 'test-pipeline',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [rule],
			getContext: async () => ({}),
		})

		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })
		expect(action).toHaveBeenCalledWith(
			expect.objectContaining({ payload: { channel: 'email' } }),
			expect.objectContaining({ strategy: 'textgrad' }),
		)
	})

	it('should not consume cadence window when action fails', async () => {
		const bus = createEventBus()
		const action = vi.fn()
			.mockRejectedValueOnce(new Error('transient failure'))
			.mockResolvedValueOnce(undefined)
		const executor = createPipelineExecutor(bus)

		executor.register({
			name: 'test-pipeline',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [],
			getContext: async () => ({}),
			cadenceMin: 60,
		})

		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })
		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })

		expect(action).toHaveBeenCalledTimes(2)
	})

	it('should respect pipeline cadence (skip if too recent)', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		executor.register({
			name: 'test-pipeline',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [],
			getContext: async () => ({}),
			cadenceMin: 60,
		})

		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })
		await bus.emit('tenant-1', 'engagement.threshold_reached', { channel: 'email' })

		expect(action).toHaveBeenCalledTimes(1)
	})
})
