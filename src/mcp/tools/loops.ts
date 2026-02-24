import { eq, and, desc, gte, count, sql } from 'drizzle-orm'
import type { Database } from '../../db/client'
import { loopPipelines, loopRules, loopEvents, loopPromptVersions, loopChannelGroups } from '../../db/schema'

export async function handleGetLoopStatus(db: Database, tenantId: string) {
	const [pipelineRows, ruleCount, eventCount, groupCount] = await Promise.all([
		db.select().from(loopPipelines)
			.where(and(eq(loopPipelines.tenantId, tenantId), eq(loopPipelines.active, true))),
		db.select({ count: count() }).from(loopRules)
			.where(and(eq(loopRules.tenantId, tenantId), eq(loopRules.active, true))),
		db.select({ count: count() }).from(loopEvents)
			.where(eq(loopEvents.tenantId, tenantId)),
		db.select({ count: count() }).from(loopChannelGroups)
			.where(eq(loopChannelGroups.tenantId, tenantId)),
	])

	return {
		pipelines: pipelineRows.map((p) => ({ name: p.name, eventType: p.eventType, runCount: p.runCount, lastRunAt: p.lastRunAt })),
		activeRules: ruleCount[0]?.count ?? 0,
		recentEvents: eventCount[0]?.count ?? 0,
		channelGroups: groupCount[0]?.count ?? 0,
	}
}

export async function handleGetPromptLineage(db: Database, channel: string, tenantId: string) {
	const versions = await db
		.select()
		.from(loopPromptVersions)
		.where(
			and(
				eq(loopPromptVersions.tenantId, tenantId),
				eq(loopPromptVersions.channel, channel),
			),
		)
		.orderBy(desc(loopPromptVersions.version))
		.limit(50)

	return {
		channel,
		versions: versions.map((v) => ({
			id: v.id,
			version: v.version,
			status: v.status,
			strategy: v.strategy,
			qualityScore: v.qualityScore,
			engagementScore: v.engagementScore,
			parentId: v.parentId,
			createdAt: v.createdAt,
			activatedAt: v.activatedAt,
		})),
	}
}

export async function handleGetLoopInsights(db: Database, days: number, tenantId: string) {
	const since = new Date(Date.now() - days * 86_400_000)

	const events = await db
		.select()
		.from(loopEvents)
		.where(
			and(
				eq(loopEvents.tenantId, tenantId),
				gte(loopEvents.createdAt, since),
			),
		)

	const optimizationCycles = events.filter((e) => e.eventType === 'optimization.completed').length
	const experimentsResolved = events.filter((e) => e.eventType === 'experiment.reward_received').length
	const driftEvents = events.filter((e) => e.eventType === 'sentiment.drift_detected').length
	const deliveryEvents = events.filter((e) => e.eventType === 'delivery.completed').length

	const total = events.length
	const summary = total === 0
		? 'No loop activity in this period.'
		: `${total} events processed: ${optimizationCycles} optimizations, ${driftEvents} drift detections, ${deliveryEvents} deliveries.`

	return {
		period: `${days} days`,
		summary,
		totalEvents: total,
		optimizationCycles,
		experimentsResolved,
		driftEvents,
		deliveryEvents,
	}
}
