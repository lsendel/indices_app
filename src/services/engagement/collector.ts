import { getPlatformAdapter } from '../../adapters/platforms'
import type { Platform, PlatformConnection, EngagementMetrics } from '../../adapters/platforms/types'
import { scoreEngagement } from './scorer'

export interface CollectInput {
	publishedContentId: string
	platformContentId: string
	platform: string
	connection: PlatformConnection
}

export interface CollectResult {
	publishedContentId: string
	metrics: EngagementMetrics
	score: number
}

export async function collectEngagement(input: CollectInput): Promise<CollectResult> {
	const adapter = getPlatformAdapter(input.platform as Platform)
	const metrics = await adapter.getEngagement(input.platformContentId, input.connection)
	const score = scoreEngagement(metrics)

	return {
		publishedContentId: input.publishedContentId,
		metrics,
		score,
	}
}
