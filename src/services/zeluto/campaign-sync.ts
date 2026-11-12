import type { ZelutoClient } from './client'
import type { ZelutoCampaignCreate } from '../../types/zeluto'

export interface CampaignSyncInput {
	name: string
	goal: string
	channels: string[]
	/** Only 'create' is allowed from Indices: sending happens behind Zeluto's own send gate. */
	action?: 'create'
	/** Must be an approved Indices campaign id; unapproved creative is never synced. */
	approvedCampaignId?: string
}

export interface CampaignSyncResult {
	zelutoCampaignId: number
	status: string
}

export function mapChannelToZelutoCampaignType(
	channels: string[],
): ZelutoCampaignCreate['type'] {
	if (channels.length === 1) {
		if (channels[0] === 'email') return 'email'
		if (channels[0] === 'sms') return 'sms'
	}
	return 'multichannel'
}

export async function syncCampaign(
	client: ZelutoClient,
	input: CampaignSyncInput,
): Promise<CampaignSyncResult> {
	const action = (input as { action?: string }).action
	if (action === 'send' || action === 'schedule') {
		throw new Error('Indices cannot send or schedule: sends go through the Zeluto send gate')
	}
	const campaign = await client.createCampaign({
		name: input.name,
		description: input.goal,
		type: mapChannelToZelutoCampaignType(input.channels),
	})
	return { zelutoCampaignId: campaign.id, status: campaign.status }
}
