import { describe, it, expect, vi } from 'vitest'
import { createSignalFeedbackHandler, DELIVERY_SCORE_MAP } from '../../../../src/services/loop/pipelines/signal-feedback'
import type { LoopEvent } from '../../../../src/services/loop'

describe('Signal Feedback Pipeline', () => {
	const deliveryEvent: LoopEvent = {
		id: 'e-1',
		tenantId: 'tenant-1',
		type: 'delivery.completed',
		payload: {
			campaignId: 'c-1',
			channel: 'email',
			accountId: 'acc-1',
			outcome: 'engaged',
		},
		timestamp: new Date(),
	}

	it('should adjust account score based on delivery outcome', async () => {
		const adjustScore = vi.fn()

		const handler = createSignalFeedbackHandler({
			adjustScore,
			recalculateLevel: vi.fn().mockResolvedValue('hot'),
		})

		await handler(deliveryEvent, {})

		expect(adjustScore).toHaveBeenCalledWith('acc-1', DELIVERY_SCORE_MAP.engaged)
	})

	it('should recalculate account level after score adjustment', async () => {
		const recalculateLevel = vi.fn().mockResolvedValue('warm')

		const handler = createSignalFeedbackHandler({
			adjustScore: vi.fn(),
			recalculateLevel,
		})

		await handler(deliveryEvent, {})

		expect(recalculateLevel).toHaveBeenCalledWith('acc-1')
	})

	it('should apply negative score for bounced delivery', async () => {
		const adjustScore = vi.fn()
		const bouncedEvent: LoopEvent = {
			...deliveryEvent,
			payload: { ...deliveryEvent.payload, outcome: 'bounced', accountId: 'acc-2' },
		}

		const handler = createSignalFeedbackHandler({
			adjustScore,
			recalculateLevel: vi.fn().mockResolvedValue('cold'),
		})

		await handler(bouncedEvent, {})

		expect(adjustScore).toHaveBeenCalledWith('acc-2', DELIVERY_SCORE_MAP.bounced)
	})

	it('should skip when no accountId in payload', async () => {
		const adjustScore = vi.fn()
		const noAccountEvent: LoopEvent = {
			...deliveryEvent,
			payload: { campaignId: 'c-1', channel: 'email', outcome: 'engaged' },
		}

		const handler = createSignalFeedbackHandler({
			adjustScore,
			recalculateLevel: vi.fn(),
		})

		await handler(noAccountEvent, {})

		expect(adjustScore).not.toHaveBeenCalled()
	})
})
