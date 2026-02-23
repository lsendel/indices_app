import { randomUUID } from 'crypto'
import type { EventType, LoopEvent, EventHandler } from './types'

export type { LoopEvent }

export interface EventBus {
	emit(tenantId: string, type: EventType, payload: Record<string, unknown>): Promise<void>
	on(type: EventType, handler: EventHandler): void
	onAny(handler: EventHandler): void
	history(tenantId: string, type?: EventType): LoopEvent[]
}

export function createEventBus(): EventBus {
	const handlers = new Map<EventType, EventHandler[]>()
	const wildcardHandlers: EventHandler[] = []
	const eventLog: LoopEvent[] = []

	return {
		async emit(tenantId, type, payload) {
			const event: LoopEvent = {
				id: randomUUID(),
				tenantId,
				type,
				payload,
				timestamp: new Date(),
			}
			eventLog.push(event)

			const typedHandlers = handlers.get(type) ?? []
			const allHandlers = [...typedHandlers, ...wildcardHandlers]

			for (const handler of allHandlers) {
				try {
					await handler(event)
				} catch (err) {
					console.error(`EventBus handler error for ${type}:`, err)
				}
			}
		},

		on(type, handler) {
			const existing = handlers.get(type) ?? []
			existing.push(handler)
			handlers.set(type, existing)
		},

		onAny(handler) {
			wildcardHandlers.push(handler)
		},

		history(tenantId, type?) {
			return eventLog.filter(
				(e) => e.tenantId === tenantId && (!type || e.type === type),
			)
		},
	}
}
