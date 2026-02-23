import { describe, it, expect, vi } from 'vitest'
import { handleGetExperimentAllocation } from '../../../src/mcp/tools/experiments'

vi.mock('../../../src/db/client', () => ({
	getDb: vi.fn().mockReturnValue({
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([
					{ id: 'arm-1', variantName: 'A', alpha: 10, beta: 3, trafficPct: 60, impressions: 100, conversions: 30 },
					{ id: 'arm-2', variantName: 'B', alpha: 5, beta: 8, trafficPct: 40, impressions: 80, conversions: 15 },
				]),
			}),
		}),
	}),
}))

describe('handleGetExperimentAllocation', () => {
	it('returns allocation with Thompson Sampling recommendations', async () => {
		const result = await handleGetExperimentAllocation('exp-1', 'tenant-1')
		expect(result.experimentId).toBe('exp-1')
		expect(result.arms).toHaveLength(2)
		expect(result.recommendedArm).toBeDefined()
	})
})
