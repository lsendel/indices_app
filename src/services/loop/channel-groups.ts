import { SUPPORTED_CHANNELS } from '../../adapters/channels'

export interface ChannelGroupDef {
	name: string
	type: 'static' | 'behavioral' | 'audience'
	channels: string[]
	criteria: Record<string, unknown> | null
	autoRefresh?: boolean
}

export function getDefaultGroups(): ChannelGroupDef[] {
	return [
		{ name: 'all-channels', type: 'static', channels: [...SUPPORTED_CHANNELS], criteria: null },
		{ name: 'social', type: 'static', channels: ['linkedin', 'facebook', 'instagram', 'tiktok'], criteria: null },
		{ name: 'video', type: 'static', channels: ['tiktok', 'youtube', 'vimeo', 'video'], criteria: null },
		{ name: 'direct-messaging', type: 'static', channels: ['email', 'sms', 'whatsapp', 'voice'], criteria: null },
		{
			name: 'high-performers', type: 'behavioral', channels: [], autoRefresh: true,
			criteria: { metric: 'engagement_score', method: 'percentile', threshold: 75, comparison: 'above' },
		},
		{
			name: 'underperformers', type: 'behavioral', channels: [], autoRefresh: true,
			criteria: { metric: 'engagement_score', method: 'percentile', threshold: 25, comparison: 'below' },
		},
		{
			name: 'growing', type: 'behavioral', channels: [], autoRefresh: true,
			criteria: { metric: 'engagement_score', method: 'trend', direction: 'positive', window_days: 28 },
		},
	]
}

export function resolveGroupMembers(group: ChannelGroupDef): string[] {
	if (group.type === 'static') return group.channels
	return group.channels
}

export function refreshBehavioralGroups(
	channelScores: Record<string, number>,
): Record<string, string[]> {
	const entries = Object.entries(channelScores).sort((a, b) => b[1] - a[1])
	const count = entries.length
	const topQuartile = Math.ceil(count * 0.25)
	const bottomQuartile = Math.ceil(count * 0.25)

	return {
		'high-performers': entries.slice(0, topQuartile).map(([ch]) => ch),
		'underperformers': entries.slice(count - bottomQuartile).map(([ch]) => ch),
		'growing': [], // Requires historical data — populated by pipeline handler
	}
}
