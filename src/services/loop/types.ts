export type EventType =
	| 'engagement.collected'
	| 'engagement.threshold_reached'
	| 'sentiment.drift_detected'
	| 'experiment.reward_received'
	| 'delivery.completed'
	| 'optimization.completed'
	| 'campaign.auto_generated'
	| 'system.circuit_breaker'

export interface LoopEvent {
	id: string
	tenantId: string
	type: EventType
	payload: Record<string, unknown>
	timestamp: Date
}

export type EventHandler = (event: LoopEvent) => Promise<void> | void
