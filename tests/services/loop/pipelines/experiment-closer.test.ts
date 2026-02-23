import { describe, it, expect, vi } from 'vitest'
import { createExperimentCloserHandler } from '../../../../src/services/loop/pipelines/experiment-closer'
import type { LoopEvent } from '../../../../src/services/loop'

describe('Experiment Auto-Closer Pipeline', () => {
	const engagementEvent: LoopEvent = {
		id: 'e-1',
		tenantId: 'tenant-1',
		type: 'engagement.collected',
		payload: { publishedContentId: 'pc-1', channel: 'email', score: 85 },
		timestamp: new Date(),
	}

	it('should reward experiment arm when content is linked', async () => {
		const rewardArm = vi.fn()

		const handler = createExperimentCloserHandler({
			getContentLineage: vi.fn().mockResolvedValue({
				experimentArmId: 'arm-1',
				campaignId: 'c-1',
			}),
			getMedianScore: vi.fn().mockResolvedValue(50),
			rewardArm,
			checkConvergence: vi.fn().mockResolvedValue({ converged: false }),
			declareWinner: vi.fn(),
		})

		await handler(engagementEvent, {})

		expect(rewardArm).toHaveBeenCalledWith('arm-1', expect.any(Number))
	})

	it('should skip when content has no experiment linkage', async () => {
		const rewardArm = vi.fn()

		const handler = createExperimentCloserHandler({
			getContentLineage: vi.fn().mockResolvedValue(null),
			getMedianScore: vi.fn().mockResolvedValue(50),
			rewardArm,
			checkConvergence: vi.fn().mockResolvedValue({ converged: false }),
			declareWinner: vi.fn(),
		})

		await handler(engagementEvent, {})

		expect(rewardArm).not.toHaveBeenCalled()
	})

	it('should declare winner when experiment converges', async () => {
		const declareWinner = vi.fn()

		const handler = createExperimentCloserHandler({
			getContentLineage: vi.fn().mockResolvedValue({
				experimentArmId: 'arm-1',
				campaignId: 'c-1',
			}),
			getMedianScore: vi.fn().mockResolvedValue(50),
			rewardArm: vi.fn(),
			checkConvergence: vi.fn().mockResolvedValue({
				converged: true,
				winnerArmId: 'arm-1',
				confidence: 0.97,
			}),
			declareWinner,
		})

		await handler(engagementEvent, {})

		expect(declareWinner).toHaveBeenCalledWith(
			expect.objectContaining({ winnerArmId: 'arm-1', confidence: 0.97 }),
		)
	})
})
