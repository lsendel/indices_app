import { describe, it, expect, vi } from 'vitest'
import { createEventBus, createPipelineExecutor, evaluateRules, getDefaultGroups, refreshBehavioralGroups } from '../../src/services/loop'
import { createEngagementWatcher } from '../../src/services/loop/watchers/engagement'
import { createSentimentWatcher } from '../../src/services/loop/watchers/sentiment'
import { createContentFlywheelHandler } from '../../src/services/loop/pipelines/content-flywheel'

describe('Phase 10 integration: closed-loop intelligence', () => {
	it('should complete full engagement → optimization → prompt storage cycle', async () => {
		const bus = createEventBus()
		const storeCandidate = vi.fn().mockResolvedValue('pv-2')

		const flywheelHandler = createContentFlywheelHandler({
			runLearning: vi.fn().mockResolvedValue({
				evaluation: { combinedScore: 0.85 },
				candidatePrompts: ['Evolved email prompt v2'],
			}),
			getActivePrompt: vi.fn().mockResolvedValue({
				id: 'pv-1', systemPrompt: 'Original prompt', instruction: 'Write email', version: 1,
			}),
			storeCandidate,
		})

		const executor = createPipelineExecutor(bus)
		executor.register({
			name: 'content-flywheel',
			eventType: 'engagement.threshold_reached',
			action: flywheelHandler,
			getRules: async () => [],
			getContext: async () => ({}),
		})

		const watcher = createEngagementWatcher(bus)
		await watcher.onEngagementCollected('tenant-1', {
			publishedContentId: 'pc-1',
			channel: 'email',
			score: 85,
			totalEvents: 150,
		})

		expect(storeCandidate).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: 'tenant-1',
				channel: 'email',
				parentId: 'pv-1',
			}),
		)
	})

	it('should gate flywheel when rule blocks channel', async () => {
		const bus = createEventBus()
		const action = vi.fn()
		const executor = createPipelineExecutor(bus)

		executor.register({
			name: 'content-flywheel',
			eventType: 'engagement.threshold_reached',
			action,
			getRules: async () => [{
				id: 'r1', name: 'block-email', priority: 1, cooldownMinutes: 0,
				conditions: [{ field: 'channel', op: 'eq' as const, value: 'email' }],
				actions: [{ type: 'gate' as const }],
				scope: {},
			}],
			getContext: async () => ({}),
		})

		const watcher = createEngagementWatcher(bus)
		await watcher.onEngagementCollected('tenant-1', {
			publishedContentId: 'pc-1',
			channel: 'email',
			score: 85,
			totalEvents: 150,
		})

		expect(action).not.toHaveBeenCalled()
	})

	it('should react to sentiment drift by triggering campaign generation', async () => {
		const bus = createEventBus()
		const generateContent = vi.fn().mockResolvedValue({})
		const executor = createPipelineExecutor(bus)

		const { createStrategicReactorHandler } = await import('../../src/services/loop/pipelines/strategic-reactor')
		const handler = createStrategicReactorHandler({
			generateContent,
			resolveChannels: () => ['linkedin', 'instagram'],
		})

		executor.register({
			name: 'strategic-reactor',
			eventType: 'sentiment.drift_detected',
			action: handler,
			getRules: async () => [],
			getContext: async () => ({}),
		})

		const watcher = createSentimentWatcher(bus)
		await watcher.onDriftDetected('tenant-1', {
			brand: 'TestBrand',
			direction: 'negative',
			zScore: 3.5,
			baselineMean: 0.6,
			currentMean: 0.1,
			themes: ['product quality'],
		})

		expect(generateContent).toHaveBeenCalledWith(
			expect.objectContaining({
				tone: 'empathetic',
				channels: ['linkedin', 'instagram'],
			}),
		)
	})

	it('should refresh behavioral channel groups from scores', () => {
		const scores = {
			email: 90, linkedin: 80, sms: 50, tiktok: 20,
			facebook: 60, instagram: 55, whatsapp: 45,
			voice: 35, youtube: 40, vimeo: 15, video: 10,
		}
		const groups = refreshBehavioralGroups(scores)
		expect(groups['high-performers']).toContain('email')
		expect(groups['underperformers']).toContain('video')
	})

	it('should support rule engine with channel groups', () => {
		const rules = [{
			id: 'r1', name: 'boost-underperformers', priority: 10, cooldownMinutes: 0,
			conditions: [{ field: 'channel', op: 'in_group' as const, value: 'underperformers' }],
			actions: [{ type: 'modify' as const, set: { strategy: 'textgrad' } }],
			scope: {},
		}]
		const context = { groups: { underperformers: ['tiktok', 'vimeo', 'video'] } }
		const result = evaluateRules(rules, { channel: 'tiktok' }, context)
		expect(result.configOverrides).toEqual({ strategy: 'textgrad' })
	})
})
