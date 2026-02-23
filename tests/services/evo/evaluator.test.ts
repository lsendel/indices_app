import { describe, it, expect, vi } from 'vitest'
import { evaluateCampaign, computeMetricScore } from '../../../src/services/evo/evaluator'
import type { LLMProvider } from '../../../src/adapters/llm/types'

function mockProvider(response: string): LLMProvider {
	return {
		name: 'mock',
		capabilities: new Set(['text', 'json']),
		generateText: vi.fn().mockResolvedValue(response),
		generateJSON: vi.fn(),
	}
}

describe('computeMetricScore', () => {
	it('computes weighted score from campaign stats', () => {
		const stats = {
			sent: 1000,
			delivered: 950,
			opened: 400,
			clicked: 80,
			bounced: 50,
			complained: 5,
		}
		const score = computeMetricScore(stats)
		expect(score).toBeGreaterThan(0)
		expect(score).toBeLessThanOrEqual(1)
	})

	it('returns 0 for zero sent', () => {
		const stats = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, complained: 0 }
		expect(computeMetricScore(stats)).toBe(0)
	})

	it('penalizes high bounce/complaint rates', () => {
		const good = computeMetricScore({
			sent: 1000, delivered: 990, opened: 400, clicked: 80, bounced: 10, complained: 0,
		})
		const bad = computeMetricScore({
			sent: 1000, delivered: 800, opened: 400, clicked: 80, bounced: 200, complained: 50,
		})
		expect(good).toBeGreaterThan(bad)
	})
})

describe('evaluateCampaign', () => {
	it('combines metric score with LLM quality assessment', async () => {
		const provider = mockProvider(JSON.stringify({ qualityScore: 0.8, feedback: 'Good targeting' }))
		const stats = {
			sent: 1000, delivered: 950, opened: 400, clicked: 80, bounced: 50, complained: 5,
		}

		const result = await evaluateCampaign(provider, stats, 'Launch product email')
		expect(result.metricScore).toBeGreaterThan(0)
		expect(result.qualityScore).toBe(0.8)
		expect(result.combinedScore).toBeGreaterThan(0)
		expect(result.feedback).toBe('Good targeting')
	})

	it('uses metric score alone when LLM fails', async () => {
		const provider = mockProvider('invalid json')
		const stats = {
			sent: 1000, delivered: 950, opened: 400, clicked: 80, bounced: 50, complained: 5,
		}

		const result = await evaluateCampaign(provider, stats, 'Some goal')
		expect(result.metricScore).toBeGreaterThan(0)
		expect(result.qualityScore).toBe(0)
		expect(result.combinedScore).toBe(result.metricScore)
	})
})
