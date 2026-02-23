import type { EventBus, LoopEvent } from './event-bus'
import type { EventType } from './types'
import { evaluateRules, type Rule } from './rule-engine'

export interface PipelineConfig {
	name: string
	eventType: EventType
	action: (event: LoopEvent, configOverrides: Record<string, unknown>) => Promise<void> | void
	getRules: (tenantId: string) => Promise<Rule[]>
	getContext: (tenantId: string) => Promise<Record<string, unknown>>
	cadenceMin?: number
}

export interface PipelineExecutor {
	register(config: PipelineConfig): void
}

const EVICTION_INTERVAL_MS = 10 * 60_000 // 10 minutes
const MAX_CADENCE_ENTRIES = 50_000

export function createPipelineExecutor(bus: EventBus): PipelineExecutor {
	const lastRunMap = new Map<string, number>()
	let lastEviction = Date.now()

	function evictStaleEntries(maxAgeMs: number) {
		const now = Date.now()
		if (now - lastEviction < EVICTION_INTERVAL_MS) return
		lastEviction = now

		for (const [key, timestamp] of lastRunMap) {
			if (now - timestamp > maxAgeMs) lastRunMap.delete(key)
		}

		// Hard cap: if still too large, remove oldest entries
		if (lastRunMap.size > MAX_CADENCE_ENTRIES) {
			const entries = [...lastRunMap.entries()].sort((a, b) => a[1] - b[1])
			const toRemove = entries.slice(0, entries.length - MAX_CADENCE_ENTRIES)
			for (const [key] of toRemove) lastRunMap.delete(key)
		}
	}

	return {
		register(config) {
			bus.on(config.eventType, async (event) => {
				const cadenceKey = `${config.name}:${event.tenantId}`
				const now = Date.now()
				const cadenceMs = (config.cadenceMin ?? 0) * 60_000

				if (config.cadenceMin) {
					const lastRun = lastRunMap.get(cadenceKey) ?? 0
					if (now - lastRun < cadenceMs) return
				}

				// Periodic eviction of stale entries
				evictStaleEntries(Math.max(cadenceMs * 2, 2 * 3600_000))

				const rules = await config.getRules(event.tenantId)
				const context = await config.getContext(event.tenantId)
				const evaluation = evaluateRules(rules, event.payload, context)

				if (evaluation.gated) return

				lastRunMap.set(cadenceKey, now)
				await config.action(event, evaluation.configOverrides)
			})
		},
	}
}
