export async function handleGetLoopStatus(tenantId: string) {
	return {
		pipelines: [],
		activeRules: 0,
		recentEvents: 0,
		channelGroups: 0,
	}
}

export async function handleGetPromptLineage(channel: string, tenantId: string) {
	return {
		channel,
		versions: [],
	}
}

export async function handleGetLoopInsights(days: number, tenantId: string) {
	return {
		period: `${days} days`,
		summary: 'No loop activity yet.',
		optimizationCycles: 0,
		experimentsResolved: 0,
		driftEvents: 0,
		accountMoves: 0,
	}
}
