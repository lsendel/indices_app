import { randomUUID } from 'crypto'
import type { EventType, LoopEvent, EventHandler } from './types'

export type { LoopEvent }

const DEFAULT_MAX_LOG = 10_000

export interface EventBusOptions {
	maxLogSize?: number
}

export interface EventBus {
	emit(tenantId: string, type: EventType, payload: Record<string, unknown>): Promise<void>
	on(type: EventType, handler: EventHandler): () => void
	onAny(handler: EventHandler): () => void
	history(tenantId: string, type?: EventType): LoopEvent[]
}

export function createEventBus(options?: EventBusOptions): EventBus {
	const maxLog = options?.maxLogSize ?? DEFAULT_MAX_LOG
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
			if (eventLog.length > maxLog) {
				eventLog.splice(0, eventLog.length - maxLog)
			}

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
			return () => {
				const list = handlers.get(type)
				if (list) {
					const idx = list.indexOf(handler)
					if (idx !== -1) list.splice(idx, 1)
				}
			}
		},

		onAny(handler) {
			wildcardHandlers.push(handler)
			return () => {
				const idx = wildcardHandlers.indexOf(handler)
				if (idx !== -1) wildcardHandlers.splice(idx, 1)
			}
		},

		history(tenantId, type?) {
			return eventLog.filter(
				(e) => e.tenantId === tenantId && (!type || e.type === type),
			)
		},
	}
}
