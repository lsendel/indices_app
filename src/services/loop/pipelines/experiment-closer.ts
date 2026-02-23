import type { LoopEvent } from '../event-bus'

export interface ContentLineageRef {
	experimentArmId: string
	campaignId: string
}

export interface ConvergenceResult {
	converged: boolean
	winnerArmId?: string
	confidence?: number
}

export interface ExperimentCloserDeps {
	getContentLineage: (publishedContentId: string) => Promise<ContentLineageRef | null>
	getMedianScore: (channel: string) => Promise<number>
	rewardArm: (armId: string, reward: number) => Promise<void> | void
	checkConvergence: (campaignId: string) => Promise<ConvergenceResult>
	declareWinner: (result: ConvergenceResult) => Promise<void> | void
}

export function createExperimentCloserHandler(deps: ExperimentCloserDeps) {
	return async (event: LoopEvent, _configOverrides: Record<string, unknown>) => {
		const publishedContentId = event.payload.publishedContentId as string
		const score = event.payload.score as number
		const channel = event.payload.channel as string

		const lineage = await deps.getContentLineage(publishedContentId)
		if (!lineage?.experimentArmId) return

		const median = await deps.getMedianScore(channel)
		const reward = score > median ? 1 : 0

		await deps.rewardArm(lineage.experimentArmId, reward)

		const convergence = await deps.checkConvergence(lineage.campaignId)
		if (convergence.converged) {
			await deps.declareWinner(convergence)
		}
	}
}
