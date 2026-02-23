import type { EventBus } from '../event-bus'

export interface DeliveryData {
	campaignId: string
	channel: string
	metrics: Record<string, number>
}

export function createDeliveryWatcher(bus: EventBus) {
	return {
		async onDeliveryCompleted(tenantId: string, data: DeliveryData) {
			await bus.emit(tenantId, 'delivery.completed', data)
		},
	}
}
