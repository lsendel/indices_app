import { eq, and, desc, sql, gte, sum, avg } from 'drizzle-orm'
import type { Database } from '../../db/client'
import { loopRules, loopEvents, loopPromptVersions, contentLineage, engagementEvents, experimentArms, experiments, accountScores } from '../../db/schema'
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
import { runLearningIteration, type LearningContext } from '../evo/learning-loop'
import { createLLMRouterFromConfig } from '../../adapters/llm/factory'
import type { LLMProvider } from '../../adapters/llm/types'

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

export interface LoopSystemConfig {
	OPENAI_API_KEY?: string
	OPENAI_MODEL?: string
	ANTHROPIC_API_KEY?: string
	GEMINI_API_KEY?: string
	PERPLEXITY_API_KEY?: string
	GROK_API_KEY?: string
	HUGGINGFACE_API_KEY?: string
}

/** Resolve an LLM provider for the learning loop, or null if none configured */
function resolveLearningProvider(config: LoopSystemConfig): LLMProvider | null {
	try {
		const router = createLLMRouterFromConfig(config as any)
		return router.resolve('analysis:sentiment')
	} catch {
		return null
	}
}

/** Build campaign stats from engagement events for a tenant+channel */
async function buildCampaignStats(db: Database, tenantId: string, channel: string) {
	const rows = await db
		.select({
			eventType: engagementEvents.eventType,
			total: sum(engagementEvents.count),
		})
		.from(engagementEvents)
		.where(eq(engagementEvents.tenantId, tenantId))
		.groupBy(engagementEvents.eventType)

	const stats: Record<string, number> = {}
	for (const r of rows) {
		stats[r.eventType] = Number(r.total ?? 0)
	}

	return {
		sent: (stats.view ?? 0) + (stats.click ?? 0) + (stats.like ?? 0),
		delivered: stats.view ?? 0,
		opened: stats.click ?? 0,
		clicked: stats.click ?? 0,
		bounced: 0,
		complained: 0,
	}
}

/** Fetch existing prompt versions as a scored population */
async function getPromptPopulation(db: Database, tenantId: string, channel: string) {
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
		.limit(10)

	return versions.map((v) => ({
		prompt: v.systemPrompt,
		score: v.qualityScore ?? 0,
	}))
}

/**
 * Bootstrap the closed-loop intelligence system.
 * Creates an event bus, registers pipelines and watchers, and returns
 * the system for use within a request lifecycle.
 */
export function bootstrapLoopSystem(db: Database, config?: LoopSystemConfig): LoopSystem {
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
	const learningProvider = config ? resolveLearningProvider(config) : null

	const flywheelHandler = createContentFlywheelHandler({
		async runLearning(context) {
			if (!learningProvider) {
				return { evaluation: { combinedScore: 0 }, candidatePrompts: [] }
			}

			const tenantId = 'default' // Resolved from event in the flywheel handler
			const campaignStats = await buildCampaignStats(db, tenantId, context.channel)
			const promptPopulation = await getPromptPopulation(db, tenantId, context.channel)

			const learningContext: LearningContext = {
				currentPrompt: context.currentPrompt,
				campaignOutput: '',
				goal: `Optimize ${context.channel} content engagement`,
				campaignStats,
				promptPopulation,
				strategy: context.strategy as LearningContext['strategy'],
			}

			const result = await runLearningIteration(learningProvider, learningContext)
			return {
				evaluation: { combinedScore: result.evaluation.combinedScore },
				candidatePrompts: result.candidatePrompts,
			}
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
		async getMedianScore(channel) {
			const [row] = await db
				.select({ median: avg(engagementEvents.count) })
				.from(engagementEvents)
				.where(eq(engagementEvents.platform, channel))
			return Number(row?.median ?? 50)
		},
		async rewardArm(armId, reward) {
			// Thompson sampling: increment alpha (success) or beta (failure)
			if (reward > 0) {
				await db.update(experimentArms)
					.set({ alpha: sql`${experimentArms.alpha} + 1`, conversions: sql`${experimentArms.conversions} + 1` })
					.where(eq(experimentArms.id, armId))
			} else {
				await db.update(experimentArms)
					.set({ beta: sql`${experimentArms.beta} + 1`, impressions: sql`${experimentArms.impressions} + 1` })
					.where(eq(experimentArms.id, armId))
			}
		},
		async checkConvergence(campaignId) {
			const arms = await db
				.select()
				.from(experimentArms)
				.where(eq(experimentArms.experimentId, campaignId))

			if (arms.length < 2) return { converged: false }

			// Simple convergence: if any arm has >= 100 total trials and clear leader
			const totalTrials = arms.map((a) => a.alpha + a.beta - 2) // subtract priors
			const minTrials = Math.min(...totalTrials)
			if (minTrials < 100) return { converged: false }

			// Find arm with highest alpha/(alpha+beta) ratio
			const sorted = [...arms].sort((a, b) => (b.alpha / (b.alpha + b.beta)) - (a.alpha / (a.alpha + a.beta)))
			const best = sorted[0]
			const secondBest = sorted[1]

			// Converged if best arm is clearly ahead (> 5% difference in win rate)
			const bestRate = best.alpha / (best.alpha + best.beta)
			const secondRate = secondBest.alpha / (secondBest.alpha + secondBest.beta)
			if (bestRate - secondRate > 0.05) {
				return { converged: true, winnerArmId: best.id, confidence: bestRate }
			}
			return { converged: false }
		},
		async declareWinner(result) {
			if (!result.winnerArmId) return
			// Find the experiment and close it
			const [arm] = await db
				.select({ experimentId: experimentArms.experimentId })
				.from(experimentArms)
				.where(eq(experimentArms.id, result.winnerArmId))
				.limit(1)
			if (!arm) return
			await db.update(experiments)
				.set({ status: 'completed', winnerId: result.winnerArmId, endedAt: new Date() })
				.where(eq(experiments.id, arm.experimentId))
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
		async adjustScore(accountId, delta) {
			await db.update(accountScores)
				.set({
					behavioralScore: sql`${accountScores.behavioralScore} + ${delta}`,
					totalScore: sql`${accountScores.totalScore} + ${delta}`,
					calculatedAt: new Date(),
				})
				.where(eq(accountScores.accountId, accountId))
		},
		async recalculateLevel(accountId) {
			const [row] = await db
				.select({ totalScore: accountScores.totalScore })
				.from(accountScores)
				.where(eq(accountScores.accountId, accountId))
				.limit(1)

			const score = row?.totalScore ?? 0
			const level: 'hot' | 'warm' | 'cold' = score >= 80 ? 'hot' : score >= 40 ? 'warm' : 'cold'

			await db.update(accountScores)
				.set({ level })
				.where(eq(accountScores.accountId, accountId))

			return level
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
	const contentProvider = config ? resolveLearningProvider(config) : null

	const strategicReactorHandler = createStrategicReactorHandler({
		async generateContent(brief) {
			if (!contentProvider) return null
			const prompt = `Generate marketing content for the following brief:
Goal: ${brief.goal}
Tone: ${brief.tone}
Keywords: ${brief.keywords.join(', ')}
Target channels: ${brief.channels.join(', ')}

Return a brief content outline suitable for these channels.`
			return contentProvider.generateText(prompt, {
				systemPrompt: 'You are a marketing content strategist. Generate concise, actionable content briefs.',
			})
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
