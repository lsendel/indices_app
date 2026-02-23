import { describe, it, expect } from 'vitest'
import { getPlatformAdapter } from '../../src/adapters/platforms'
import { scoreEngagement, metricsToEvoStats } from '../../src/services/engagement/scorer'
import { shouldTriggerOptimization } from '../../src/services/engagement/optimizer-trigger'
import type { EngagementMetrics } from '../../src/adapters/platforms/types'

describe('Phase 8 integration: publish → engage → learn', () => {
	it('should score engagement with correct weights', () => {
		const metrics: EngagementMetrics = {
			views: 1000, likes: 50, shares: 10, comments: 20,
			clicks: 30, saves: 15, conversions: 5,
		}

		const score = scoreEngagement(metrics)
		// 1000*1 + 50*2 + 10*5 + 20*3 + 30*3 + 15*4 + 5*10
		expect(score).toBe(1000 + 100 + 50 + 60 + 90 + 60 + 50)
	})

	it('should convert metrics to EvoAgentX CampaignStats', () => {
		const metrics: EngagementMetrics = {
			views: 500, likes: 25, shares: 5, comments: 10,
			clicks: 15, saves: 8, conversions: 3,
		}

		const stats = metricsToEvoStats(metrics)
		expect(stats.sent).toBe(500)
		expect(stats.opened).toBe(500)
		expect(stats.clicked).toBe(40) // clicks + likes
	})

	it('should trigger optimization when threshold met', () => {
		const result = shouldTriggerOptimization(150, 100)
		expect(result.triggered).toBe(true)
	})

	it('should not trigger optimization below threshold', () => {
		const result = shouldTriggerOptimization(50, 100)
		expect(result.triggered).toBe(false)
	})

	it('should get adapter for all 7 platforms', () => {
		const platforms = ['instagram', 'facebook', 'whatsapp', 'tiktok', 'linkedin', 'wordpress', 'blog'] as const
		for (const platform of platforms) {
			const adapter = getPlatformAdapter(platform)
			expect(adapter.name).toBe(platform)
		}
	})
})
