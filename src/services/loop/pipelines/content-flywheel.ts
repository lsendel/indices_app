import type { LoopEvent } from '../event-bus'

export interface ActivePrompt {
	id: string
	systemPrompt: string
	instruction: string
	version?: number
}

export interface CandidateInput {
	tenantId: string
	channel: string
	systemPrompt: string
	instruction: string
	parentId: string
	strategy: string
	qualityScore: number
}

export interface FlywheelDeps {
	runLearning: (context: { channel: string; strategy: string; currentPrompt: string }) => Promise<{
		evaluation: { combinedScore: number }
		candidatePrompts: string[]
	}>
	getActivePrompt: (tenantId: string, channel: string) => Promise<ActivePrompt | null>
	storeCandidate: (input: CandidateInput) => Promise<string>
}

export function createContentFlywheelHandler(deps: FlywheelDeps) {
	return async (event: LoopEvent, configOverrides: Record<string, unknown>) => {
		const channel = event.payload.channel as string
		const strategy = (configOverrides.strategy as string) ?? 'hybrid'

		const activePrompt = await deps.getActivePrompt(event.tenantId, channel)
		if (!activePrompt) return

		const result = await deps.runLearning({
			channel,
			strategy,
			currentPrompt: activePrompt.systemPrompt,
		})

		if (result.candidatePrompts.length === 0) return

		await deps.storeCandidate({
			tenantId: event.tenantId,
			channel,
			systemPrompt: result.candidatePrompts[0],
			instruction: activePrompt.instruction,
			parentId: activePrompt.id,
			strategy,
			qualityScore: result.evaluation.combinedScore,
		})
	}
}
