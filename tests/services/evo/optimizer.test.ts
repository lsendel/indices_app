import { describe, it, expect, vi } from 'vitest'
import { runOptimizationCycle } from '../../../src/services/evo/optimizer'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn()
			// computeLoss responses
			.mockResolvedValueOnce(JSON.stringify({ loss: 0.6, analysis: 'Needs more personalization' }))
			// computeGradient response
			.mockResolvedValueOnce(JSON.stringify({ gradient: 'Add personalization', suggestedPrompt: 'Improved prompt v1' }))
			// applyGradient response
			.mockResolvedValueOnce('Improved prompt with personalization and urgency.')
			// crossover response
			.mockResolvedValueOnce('Crossover child prompt.')
			// mutate response
			.mockResolvedValueOnce('Mutated child prompt.'),
	}
}

describe('runOptimizationCycle', () => {
	it('runs a single optimization cycle with TextGrad + GA', async () => {
		const adapter = mockAdapter()
		const result = await runOptimizationCycle(adapter, {
			currentPrompt: 'Write a marketing email.',
			output: 'Dear customer, buy stuff.',
			goal: 'Personalized product launch email',
			population: [
				{ prompt: 'Prompt A', score: 0.5 },
				{ prompt: 'Prompt B', score: 0.3 },
			],
			strategy: 'hybrid',
		})

		expect(result.textgradPrompt).toBeDefined()
		expect(result.gaChildren.length).toBeGreaterThan(0)
		expect(result.loss).toBe(0.6)
		expect(result.gradient).toContain('personalization')
	})

	it('runs TextGrad only when strategy is textgrad', async () => {
		const adapter = mockAdapter()
		const result = await runOptimizationCycle(adapter, {
			currentPrompt: 'Write email.',
			output: 'Output.',
			goal: 'Goal.',
			population: [],
			strategy: 'textgrad',
		})

		expect(result.textgradPrompt).toBeDefined()
		expect(result.gaChildren).toHaveLength(0)
	})
})
