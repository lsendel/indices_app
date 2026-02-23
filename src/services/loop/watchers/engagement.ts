import type { EventBus } from '../event-bus'
import { shouldTriggerOptimization } from '../../engagement/optimizer-trigger'

export interface EngagementData {
	publishedContentId: string
	channel: string
	score: number
	totalEvents: number
}

export function createEngagementWatcher(bus: EventBus) {
	return {
		async onEngagementCollected(tenantId: string, data: EngagementData) {
			await bus.emit(tenantId, 'engagement.collected', data)

			const trigger = shouldTriggerOptimization(data.totalEvents)
			if (trigger.triggered) {
				await bus.emit(tenantId, 'engagement.threshold_reached', {
					channel: data.channel,
					currentScore: data.score,
					totalEvents: data.totalEvents,
					threshold: trigger.threshold,
				})
			}
		},
	}
}
