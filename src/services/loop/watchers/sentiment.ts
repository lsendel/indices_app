import type { EventBus } from '../event-bus'

export interface DriftData {
	brand: string
	direction: 'positive' | 'negative'
	zScore: number
	baselineMean: number
	currentMean: number
	themes: string[]
}

export function createSentimentWatcher(bus: EventBus) {
	return {
		async onDriftDetected(tenantId: string, data: DriftData) {
			await bus.emit(tenantId, 'sentiment.drift_detected', data)
		},
	}
}
