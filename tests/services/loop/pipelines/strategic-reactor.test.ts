import { describe, it, expect, vi } from 'vitest'
import { createStrategicReactorHandler } from '../../../../src/services/loop/pipelines/strategic-reactor'
import type { LoopEvent } from '../../../../src/services/loop'

describe('Strategic Reactor Pipeline', () => {
	const driftEvent: LoopEvent = {
		id: 'e-1',
		tenantId: 'tenant-1',
		type: 'sentiment.drift_detected',
		payload: { brand: 'TestBrand', direction: 'negative', zScore: 3.0, themes: ['product issues'] },
		timestamp: new Date(),
	}

	it('should generate campaign brief from drift context', async () => {
		const generateContent = vi.fn().mockResolvedValue({ subject: 'Response' })

		const handler = createStrategicReactorHandler({
			generateContent,
			resolveChannels: vi.fn().mockReturnValue(['linkedin', 'instagram']),
		})

		await handler(driftEvent, {})

		expect(generateContent).toHaveBeenCalledWith(
			expect.objectContaining({
				goal: expect.stringContaining('TestBrand'),
				channels: ['linkedin', 'instagram'],
			}),
		)
	})

	it('should apply configOverrides for tone, channels, and keywords', async () => {
		const generateContent = vi.fn().mockResolvedValue({})

		const handler = createStrategicReactorHandler({
			generateContent,
			resolveChannels: vi.fn().mockReturnValue(['linkedin']),
		})

		await handler(driftEvent, { tone: 'urgent', channels: ['email', 'sms'], keywords: ['recall'] })

		expect(generateContent).toHaveBeenCalledWith(
			expect.objectContaining({
				tone: 'urgent',
				channels: ['email', 'sms'],
				keywords: ['product issues', 'recall'],
			}),
		)
	})

	it('should use empathetic tone for negative drift', async () => {
		const generateContent = vi.fn().mockResolvedValue({})

		const handler = createStrategicReactorHandler({
			generateContent,
			resolveChannels: vi.fn().mockReturnValue(['linkedin']),
		})

		await handler(driftEvent, {})

		expect(generateContent).toHaveBeenCalledWith(
			expect.objectContaining({ tone: 'empathetic' }),
		)
	})
})
