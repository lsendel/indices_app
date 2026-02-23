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

export function createPipelineExecutor(bus: EventBus): PipelineExecutor {
	const lastRunMap = new Map<string, number>()

	return {
		register(config) {
			bus.on(config.eventType, async (event) => {
				const cadenceKey = `${config.name}:${event.tenantId}`
				const now = Date.now()

				if (config.cadenceMin) {
					const lastRun = lastRunMap.get(cadenceKey) ?? 0
					if (now - lastRun < config.cadenceMin * 60_000) return
				}

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
