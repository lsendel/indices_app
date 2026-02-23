import { getPlatformAdapter } from '../../adapters/platforms'
import type { Platform, PlatformConnection, EngagementMetrics } from '../../adapters/platforms/types'

export interface PollTarget {
	publishedContentId: string
	platformContentId: string
	platform: string
	connection: PlatformConnection
}

export interface PollResult extends PollTarget {
	metrics: EngagementMetrics
}

export async function pollEngagement(targets: PollTarget[]): Promise<PollResult[]> {
	const results = await Promise.all(
		targets.map(async (target) => {
			const adapter = getPlatformAdapter(target.platform as Platform)
			const metrics = await adapter.getEngagement(target.platformContentId, target.connection)
			return { ...target, metrics }
		}),
	)
	return results
}
