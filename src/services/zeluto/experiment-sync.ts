import type { ZelutoClient } from './client'
import type { ZelutoAbTestCreate } from '../../types/zeluto'

export interface ArmData {
	id: string
	variantName: string
	content: Record<string, unknown>
	trafficPct: number
}

export interface ExperimentSyncInput {
	experimentName: string
	zelutoCampaignId: number
	arms: ArmData[]
	winningCriteria: ZelutoAbTestCreate['winningCriteria']
}

export interface ExperimentSyncResult {
	zelutoAbTestId: number
}

export function mapArmsToVariants(
	arms: ArmData[],
): Array<Record<string, unknown>> {
	return arms.map((arm) => ({
		name: arm.variantName,
		content: arm.content,
		trafficPct: arm.trafficPct,
		armId: arm.id,
	}))
}

export async function syncExperiment(
	client: ZelutoClient,
	input: ExperimentSyncInput,
): Promise<ExperimentSyncResult> {
	const abTest = await client.createAbTest({
		campaignId: input.zelutoCampaignId,
		name: input.experimentName,
		variants: mapArmsToVariants(input.arms),
		winningCriteria: input.winningCriteria,
	})

	return { zelutoAbTestId: abTest.id }
}
