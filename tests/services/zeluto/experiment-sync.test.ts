import { describe, it, expect, vi } from 'vitest'
import {
	syncExperiment,
	mapArmsToVariants,
} from '../../../src/services/zeluto/experiment-sync'

describe('experiment sync', () => {
	describe('mapArmsToVariants', () => {
		it('maps experiment arms to zeluto variants', () => {
			const arms = [
				{ id: 'arm-1', variantName: 'Control', content: { subject: 'Hello' }, trafficPct: 0.5 },
				{ id: 'arm-2', variantName: 'Variant B', content: { subject: 'Hi!' }, trafficPct: 0.5 },
			]

			const variants = mapArmsToVariants(arms)
			expect(variants).toHaveLength(2)
			expect(variants[0]).toEqual({
				name: 'Control',
				content: { subject: 'Hello' },
				trafficPct: 0.5,
				armId: 'arm-1',
			})
		})
	})

	describe('syncExperiment', () => {
		it('creates A/B test via client', async () => {
			const mockClient = {
				createAbTest: vi.fn().mockResolvedValue({
					id: 7,
					campaignId: 10,
					status: 'running',
				}),
			}

			const arms = [
				{ id: 'a1', variantName: 'A', content: {}, trafficPct: 0.5 },
				{ id: 'a2', variantName: 'B', content: {}, trafficPct: 0.5 },
			]

			const result = await syncExperiment(mockClient as any, {
				experimentName: 'Subject Test',
				zelutoCampaignId: 10,
				arms,
				winningCriteria: 'clicks',
			})

			expect(result.zelutoAbTestId).toBe(7)
			expect(mockClient.createAbTest).toHaveBeenCalledWith({
				campaignId: 10,
				name: 'Subject Test',
				variants: expect.arrayContaining([
					expect.objectContaining({ name: 'A' }),
					expect.objectContaining({ name: 'B' }),
				]),
				winningCriteria: 'clicks',
			})
		})
	})
})
