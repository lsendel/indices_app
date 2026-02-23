import type { LoopEvent } from '../event-bus'

export const DELIVERY_SCORE_MAP: Record<string, number> = {
	engaged: 10,
	ignored: -2,
	bounced: -15,
	unsubscribed: -25,
}

export interface SignalFeedbackDeps {
	adjustScore: (accountId: string, delta: number) => Promise<void> | void
	recalculateLevel: (accountId: string) => Promise<'hot' | 'warm' | 'cold'>
}

export function createSignalFeedbackHandler(deps: SignalFeedbackDeps) {
	return async (event: LoopEvent, _configOverrides: Record<string, unknown>) => {
		const accountId = event.payload.accountId as string | undefined
		if (!accountId) return

		const outcome = event.payload.outcome as string
		const delta = DELIVERY_SCORE_MAP[outcome] ?? 0

		await deps.adjustScore(accountId, delta)
		await deps.recalculateLevel(accountId)
	}
}
