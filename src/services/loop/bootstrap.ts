import { eq, and, desc, sql, gte } from 'drizzle-orm'
import type { Database } from '../../db/client'
import { loopRules, loopEvents, loopPromptVersions, contentLineage } from '../../db/schema'
import { createEventBus, type EventBus } from './event-bus'
import { createPipelineExecutor, type PipelineConfig } from './pipeline-executor'
import { createEngagementWatcher } from './watchers/engagement'
import { createSentimentWatcher } from './watchers/sentiment'
import { createDeliveryWatcher } from './watchers/delivery'
import { createContentFlywheelHandler } from './pipelines/content-flywheel'
import { createExperimentCloserHandler } from './pipelines/experiment-closer'
import { createSignalFeedbackHandler } from './pipelines/signal-feedback'
import { createStrategicReactorHandler } from './pipelines/strategic-reactor'
import type { Rule } from './rule-engine'

export interface LoopSystem {
	bus: EventBus
	watchers: {
		engagement: ReturnType<typeof createEngagementWatcher>
		sentiment: ReturnType<typeof createSentimentWatcher>
		delivery: ReturnType<typeof createDeliveryWatcher>
	}
}

/** Fetch active rules for a given pipeline event type */
async function getRulesForEvent(db: Database, tenantId: string, eventType: string): Promise<Rule[]> {
	const rows = await db
		.select()
		.from(loopRules)
		.where(and(eq(loopRules.tenantId, tenantId), eq(loopRules.active, true)))

	return rows
		.filter((r) => {
			const scope = r.scope as Record<string, unknown>
			return !scope.eventType || scope.eventType === eventType
		})
		.map((r) => ({
			id: r.id,
			name: r.name,
			priority: r.priority,
			cooldownMinutes: r.cooldownMinutes,
			conditions: r.conditions as Rule['conditions'],
			actions: r.actions as Rule['actions'],
			scope: r.scope as Record<string, unknown>,
			lastFiredAt: r.lastFiredAt ?? undefined,
		}))
}

/** Persist a loop event to the DB for cross-request querying */
async function persistEvent(
	db: Database,
	tenantId: string,
	eventType: string,
	payload: Record<string, unknown>,
	outcome: 'processed' | 'gated' | 'error' | 'skipped',
	durationMs?: number,
) {
	await db.insert(loopEvents).values({
		tenantId,
		eventType,
		payload,
		outcome,
		durationMs,
	})
}

/**
 * Bootstrap the closed-loop intelligence system.
 * Creates an event bus, registers pipelines and watchers, and returns
 * the system for use within a request lifecycle.
 */
export function bootstrapLoopSystem(db: Database): LoopSystem {
	const bus = createEventBus()
	const executor = createPipelineExecutor(bus)

	// --- Watchers ---
	const engagementWatcher = createEngagementWatcher(bus)
	const sentimentWatcher = createSentimentWatcher(bus)
	const deliveryWatcher = createDeliveryWatcher(bus)

	// --- Persist all events to DB ---
	bus.onAny(async (event) => {
		await persistEvent(db, event.tenantId, event.type, event.payload, 'processed')
	})

	// --- Pipeline: Content Flywheel ---
	// Triggered by engagement.threshold_reached → runs learning iteration → stores candidate prompts
	const flywheelHandler = createContentFlywheelHandler({
		async runLearning(context) {
			// Placeholder: real LLM integration wired in Phase 3 (Task 8)
			return { evaluation: { combinedScore: 0 }, candidatePrompts: [] }
		},
		async getActivePrompt(tenantId, channel) {
			const [row] = await db
				.select()
				.from(loopPromptVersions)
				.where(
					and(
						eq(loopPromptVersions.tenantId, tenantId),
						eq(loopPromptVersions.channel, channel),
						eq(loopPromptVersions.status, 'active'),
					),
				)
				.limit(1)
			if (!row) return null
			return { id: row.id, systemPrompt: row.systemPrompt, instruction: row.instruction, version: row.version }
		},
		async storeCandidate(input) {
			const [maxVersion] = await db
				.select({ max: sql<number>`coalesce(max(${loopPromptVersions.version}), 0)` })
				.from(loopPromptVersions)
				.where(
					and(
						eq(loopPromptVersions.tenantId, input.tenantId),
						eq(loopPromptVersions.channel, input.channel),
					),
				)
			const [row] = await db
				.insert(loopPromptVersions)
				.values({
					tenantId: input.tenantId,
					channel: input.channel,
					systemPrompt: input.systemPrompt,
					instruction: input.instruction,
					version: (maxVersion?.max ?? 0) + 1,
					parentId: input.parentId,
					strategy: input.strategy,
					qualityScore: input.qualityScore,
					status: 'candidate',
				})
				.returning({ id: loopPromptVersions.id })
			return row.id
		},
	})

	executor.register({
		name: 'content-flywheel',
		eventType: 'engagement.threshold_reached',
		action: flywheelHandler,
		getRules: (tenantId) => getRulesForEvent(db, tenantId, 'engagement.threshold_reached'),
		getContext: async () => ({}),
		cadenceMin: 30,
	})

	// --- Pipeline: Experiment Closer ---
	// Triggered by engagement.collected → rewards arms, checks convergence
	const experimentCloserHandler = createExperimentCloserHandler({
		async getContentLineage(publishedContentId) {
			const [row] = await db
				.select()
				.from(contentLineage)
				.where(eq(contentLineage.publishedContentId, publishedContentId))
				.limit(1)
			if (!row) return null
			return {
				experimentArmId: row.experimentArmId ?? '',
				campaignId: row.campaignId ?? '',
			}
		},
		async getMedianScore(_channel) {
			return 50 // Default median — will be computed from real data when engagement events accumulate
		},
		async rewardArm(_armId, _reward) {
			// Will wire to Thompson sampling in Phase 3
		},
		async checkConvergence(_campaignId) {
			return { converged: false }
		},
		async declareWinner(_result) {
			// Will wire to experiment resolution
		},
	})

	executor.register({
		name: 'experiment-closer',
		eventType: 'engagement.collected',
		action: experimentCloserHandler,
		getRules: (tenantId) => getRulesForEvent(db, tenantId, 'engagement.collected'),
		getContext: async () => ({}),
		cadenceMin: 5,
	})

	// --- Pipeline: Signal Feedback ---
	// Triggered by delivery.completed → adjusts account scores
	const signalFeedbackHandler = createSignalFeedbackHandler({
		async adjustScore(_accountId, _delta) {
			// Will wire to accounts table score update
		},
		async recalculateLevel(_accountId) {
			return 'warm'
		},
	})

	executor.register({
		name: 'signal-feedback',
		eventType: 'delivery.completed',
		action: signalFeedbackHandler,
		getRules: (tenantId) => getRulesForEvent(db, tenantId, 'delivery.completed'),
		getContext: async () => ({}),
	})

	// --- Pipeline: Strategic Reactor ---
	// Triggered by sentiment.drift_detected → generates reactive content
	const strategicReactorHandler = createStrategicReactorHandler({
		async generateContent(_brief) {
			// Will wire to LLM content generation in later phase
		},
		resolveChannels(direction) {
			return direction === 'negative'
				? ['email', 'linkedin']
				: ['instagram', 'facebook', 'linkedin']
		},
	})

	executor.register({
		name: 'strategic-reactor',
		eventType: 'sentiment.drift_detected',
		action: strategicReactorHandler,
		getRules: (tenantId) => getRulesForEvent(db, tenantId, 'sentiment.drift_detected'),
		getContext: async () => ({}),
		cadenceMin: 60,
	})

	return { bus, watchers: { engagement: engagementWatcher, sentiment: sentimentWatcher, delivery: deliveryWatcher } }
}
