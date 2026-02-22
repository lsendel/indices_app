import type { ZelutoClient } from './client'
import type { ZelutoCampaignCreate } from '../../types/zeluto'

export interface CampaignSyncInput {
	name: string
	goal: string
	channels: string[]
	action?: 'create' | 'send' | 'schedule'
	scheduledAt?: string
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
	const campaign = await client.createCampaign({
		name: input.name,
		description: input.goal,
		type: mapChannelToZelutoCampaignType(input.channels),
	})

	let status = campaign.status

	if (input.action === 'send') {
		const sent = await client.sendCampaign(campaign.id)
		status = sent.status
	} else if (input.action === 'schedule' && input.scheduledAt) {
		const scheduled = await client.scheduleCampaign(campaign.id, input.scheduledAt)
		status = scheduled.status
	}

	return { zelutoCampaignId: campaign.id, status }
}
