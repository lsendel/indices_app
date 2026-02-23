import { describe, it, expect, vi } from 'vitest'
import { runLearningIteration, type LearningContext } from '../../../src/services/evo/learning-loop'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn()
			// evaluateCampaign: computeMetricScore is pure, LLM quality assessment
			.mockResolvedValueOnce(JSON.stringify({ qualityScore: 0.7, feedback: 'Good engagement' }))
			// optimizer: computeLoss
			.mockResolvedValueOnce(JSON.stringify({ loss: 0.3, analysis: 'Minor issues' }))
			// optimizer: computeGradient
			.mockResolvedValueOnce(JSON.stringify({ gradient: 'Improve CTA', suggestedPrompt: 'Better prompt' }))
			// optimizer: applyGradient
			.mockResolvedValueOnce('Optimized prompt with better CTA.')
			// optimizer: crossover
			.mockResolvedValueOnce('Crossover child.')
			// optimizer: mutate
			.mockResolvedValueOnce('Mutated child.'),
	}
}

describe('runLearningIteration', () => {
	it('runs evaluate → optimize cycle and returns results', async () => {
		const adapter = mockAdapter()
		const context: LearningContext = {
			currentPrompt: 'Write email for product launch.',
			campaignOutput: 'Dear customer, check out our new product!',
			goal: 'Drive product awareness',
			campaignStats: {
				sent: 1000, delivered: 950, opened: 380, clicked: 75, bounced: 50, complained: 3,
			},
			promptPopulation: [
				{ prompt: 'Prompt A', score: 0.5 },
				{ prompt: 'Prompt B', score: 0.4 },
			],
			strategy: 'hybrid',
		}

		const result = await runLearningIteration(adapter, context)
		expect(result.evaluation.combinedScore).toBeGreaterThan(0)
		expect(result.optimization.textgradPrompt).toBeDefined()
		expect(result.optimization.gaChildren.length).toBeGreaterThan(0)
		expect(result.candidatePrompts.length).toBeGreaterThan(0)
	})

	it('collects all candidate prompts for scoring', async () => {
		const adapter = mockAdapter()
		const context: LearningContext = {
			currentPrompt: 'Base prompt.',
			campaignOutput: 'Some output.',
			goal: 'Some goal.',
			campaignStats: {
				sent: 100, delivered: 95, opened: 30, clicked: 5, bounced: 5, complained: 0,
			},
			promptPopulation: [
				{ prompt: 'A', score: 0.6 },
				{ prompt: 'B', score: 0.4 },
			],
			strategy: 'hybrid',
		}

		const result = await runLearningIteration(adapter, context)
		// Should include: textgrad prompt + GA children
		expect(result.candidatePrompts.length).toBeGreaterThanOrEqual(1)
	})
})
