const DEFAULT_THRESHOLD = 100

export interface TriggerResult {
	triggered: boolean
	totalEvents: number
	threshold: number
}

export function shouldTriggerOptimization(
	totalEvents: number,
	threshold = DEFAULT_THRESHOLD,
): TriggerResult {
	return {
		triggered: totalEvents >= threshold,
		totalEvents,
		threshold,
	}
}
