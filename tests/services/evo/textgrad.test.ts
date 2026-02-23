import { describe, it, expect, vi } from 'vitest'
import { computeLoss, computeGradient, applyGradient } from '../../../src/services/evo/textgrad'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(response: string): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn().mockResolvedValue(response),
	}
}

describe('computeLoss', () => {
	it('asks LLM to evaluate prompt output quality and returns a loss string', async () => {
		const adapter = mockAdapter(JSON.stringify({
			loss: 0.4,
			analysis: 'The email is too generic and lacks personalization.',
		}))
		const result = await computeLoss(adapter, {
			prompt: 'Write a marketing email.',
			output: 'Dear customer, buy our product.',
			goal: 'Personalized product email',
		})
		expect(result.loss).toBe(0.4)
		expect(result.analysis).toContain('generic')
	})

	it('returns high loss on LLM failure', async () => {
		const adapter = mockAdapter('bad json')
		const result = await computeLoss(adapter, {
			prompt: 'test',
			output: 'test',
			goal: 'test',
		})
		expect(result.loss).toBe(1)
	})
})

describe('computeGradient', () => {
	it('returns fallback when LLM response has wrong shape', async () => {
		const adapter = mockAdapter(JSON.stringify({ foo: 'bar' }))
		const result = await computeGradient(adapter, {
			prompt: 'Write a marketing email.',
			lossAnalysis: 'Too generic.',
		})
		expect(result.gradient).toBe('Unable to compute gradient')
		expect(result.suggestedPrompt).toBe('Write a marketing email.')
	})

	it('asks LLM for prompt improvement suggestions', async () => {
		const adapter = mockAdapter(JSON.stringify({
			gradient: 'Add personalization tokens and urgency language.',
			suggestedPrompt: 'Write a personalized marketing email with urgency.',
		}))

		const result = await computeGradient(adapter, {
			prompt: 'Write a marketing email.',
			lossAnalysis: 'Too generic, lacks personalization.',
		})
		expect(result.gradient).toContain('personalization')
		expect(result.suggestedPrompt).toContain('personalized')
	})
})

describe('applyGradient', () => {
	it('asks LLM to apply gradient to produce improved prompt', async () => {
		const improved = 'Write a personalized, urgency-driven marketing email for {audience}.'
		const adapter = mockAdapter(improved)

		const result = await applyGradient(adapter, {
			currentPrompt: 'Write a marketing email.',
			gradient: 'Add personalization and urgency.',
		})
		expect(result).toContain('personalized')
	})
})
