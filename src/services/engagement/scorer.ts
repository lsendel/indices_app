import type { EngagementMetrics } from '../../adapters/platforms/types'

const WEIGHTS = {
	views: 1,
	likes: 2,
	shares: 5,
	comments: 3,
	clicks: 3,
	saves: 4,
	conversions: 10,
}

export function scoreEngagement(metrics: EngagementMetrics): number {
	let score = 0
	for (const [key, weight] of Object.entries(WEIGHTS)) {
		score += (metrics[key as keyof EngagementMetrics] ?? 0) * weight
	}
	return score
}

export function metricsToEvoStats(metrics: EngagementMetrics) {
	const total = metrics.views || 1
	return {
		sent: total,
		delivered: total,
		opened: metrics.views,
		clicked: metrics.clicks + metrics.likes,
		bounced: 0,
		complained: 0,
	}
}
