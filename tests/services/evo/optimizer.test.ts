import { describe, it, expect, vi } from 'vitest'
import { runOptimizationCycle } from '../../../src/services/evo/optimizer'
import { GRADIENT_FAILURE } from '../../../src/services/evo/textgrad'
import type { LLMProvider } from '../../../src/adapters/llm/types'

function mockProvider(): LLMProvider {
	return {
		name: 'mock',
		capabilities: new Set(['text', 'json']),
		generateText: vi.fn()
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
		generateJSON: vi.fn(),
	}
}

describe('runOptimizationCycle', () => {
	it('runs a single optimization cycle with TextGrad + GA', async () => {
		const provider = mockProvider()
		const result = await runOptimizationCycle(provider, {
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
		const provider = mockProvider()
		const result = await runOptimizationCycle(provider, {
			currentPrompt: 'Write email.',
			output: 'Output.',
			goal: 'Goal.',
			population: [],
			strategy: 'textgrad',
		})

		expect(result.textgradPrompt).toBeDefined()
		expect(result.gaChildren).toHaveLength(0)
	})

	it('runs DE mutation when strategy is de and population >= 3', async () => {
		const provider: LLMProvider = {
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn()
				// deMutatePrompt response
				.mockResolvedValueOnce('DE-evolved prompt.'),
			generateJSON: vi.fn(),
		}

		const result = await runOptimizationCycle(provider, {
			currentPrompt: 'Write email.',
			output: 'Output.',
			goal: 'Goal.',
			population: [
				{ prompt: 'Best', score: 0.9 },
				{ prompt: 'Mid', score: 0.5 },
				{ prompt: 'Low', score: 0.2 },
			],
			strategy: 'de',
		})

		expect(result.textgradPrompt).toBeNull()
		expect(result.gaChildren).toEqual(['DE-evolved prompt.'])
	})

	it('skips applyGradient when computeGradient fails', async () => {
		const provider: LLMProvider = {
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn()
				// computeLoss response
				.mockResolvedValueOnce(JSON.stringify({ loss: 0.8, analysis: 'Poor quality' }))
				// computeGradient returns wrong shape -> fallback
				.mockResolvedValueOnce(JSON.stringify({ wrong: 'shape' })),
			generateJSON: vi.fn(),
		}

		const result = await runOptimizationCycle(provider, {
			currentPrompt: 'Original prompt.',
			output: 'Bad output.',
			goal: 'Good output.',
			population: [],
			strategy: 'textgrad',
		})

		expect(result.textgradPrompt).toBe('Original prompt.')
		expect(result.gradient).toBe(GRADIENT_FAILURE)
		expect(provider.generateText).toHaveBeenCalledTimes(2)
	})

	it('skips DE when population < 3', async () => {
		const provider: LLMProvider = {
			name: 'mock',
			capabilities: new Set(['text', 'json']),
			generateText: vi.fn(),
			generateJSON: vi.fn(),
		}

		const result = await runOptimizationCycle(provider, {
			currentPrompt: 'Write email.',
			output: 'Output.',
			goal: 'Goal.',
			population: [
				{ prompt: 'A', score: 0.5 },
				{ prompt: 'B', score: 0.3 },
			],
			strategy: 'de',
		})

		expect(result.textgradPrompt).toBeNull()
		expect(result.gaChildren).toHaveLength(0)
		expect(provider.generateText).not.toHaveBeenCalled()
	})
})
