import { describe, it, expect } from 'vitest'
import { scoreEngagement, metricsToEvoStats } from '../../../src/services/engagement/scorer'
import type { EngagementMetrics } from '../../../src/adapters/platforms/types'

describe('scoreEngagement', () => {
	it('should apply correct weights to each metric', () => {
		const metrics: EngagementMetrics = {
			views: 1000,
			likes: 50,
			shares: 10,
			comments: 20,
			clicks: 30,
			saves: 15,
			conversions: 5,
		}

		const score = scoreEngagement(metrics)
		// 1000*1 + 50*2 + 10*5 + 20*3 + 30*3 + 15*4 + 5*10
		expect(score).toBe(1000 + 100 + 50 + 60 + 90 + 60 + 50)
	})

	it('should return 0 for empty metrics', () => {
		const metrics: EngagementMetrics = {
			views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0,
		}
		expect(scoreEngagement(metrics)).toBe(0)
	})

	it('should weight conversions highest', () => {
		const withConversions: EngagementMetrics = {
			views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 10,
		}
		const withViews: EngagementMetrics = {
			views: 10, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0,
		}
		expect(scoreEngagement(withConversions)).toBeGreaterThan(scoreEngagement(withViews))
	})
})

describe('metricsToEvoStats', () => {
	it('should convert metrics to EvoAgentX CampaignStats format', () => {
		const metrics: EngagementMetrics = {
			views: 500, likes: 25, shares: 5, comments: 10,
			clicks: 15, saves: 8, conversions: 3,
		}

		const stats = metricsToEvoStats(metrics)
		expect(stats.sent).toBe(500)
		expect(stats.delivered).toBe(500)
		expect(stats.opened).toBe(500)
		expect(stats.clicked).toBe(40) // clicks + likes
		expect(stats.bounced).toBe(0)
		expect(stats.complained).toBe(0)
	})

	it('should handle zero views without division by zero', () => {
		const metrics: EngagementMetrics = {
			views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0,
		}
		const stats = metricsToEvoStats(metrics)
		expect(stats.sent).toBe(1) // fallback to 1
	})
})
