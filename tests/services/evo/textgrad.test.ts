import { describe, it, expect, vi } from 'vitest'
import { computeLoss, computeGradient, applyGradient, GRADIENT_FAILURE, LOSS_FAILURE } from '../../../src/services/evo/textgrad'
import type { LLMProvider } from '../../../src/adapters/llm/types'

function mockProvider(response: string): LLMProvider {
	return {
		name: 'mock',
		capabilities: new Set(['text', 'json']),
		generateText: vi.fn().mockResolvedValue(response),
		generateJSON: vi.fn(),
	}
}

describe('computeLoss', () => {
	it('asks LLM to evaluate prompt output quality and returns a loss string', async () => {
		const provider = mockProvider(JSON.stringify({
			loss: 0.4,
			analysis: 'The email is too generic and lacks personalization.',
		}))
		const result = await computeLoss(provider, {
			prompt: 'Write a marketing email.',
			output: 'Dear customer, buy our product.',
			goal: 'Personalized product email',
		})
		expect(result.loss).toBe(0.4)
		expect(result.analysis).toContain('generic')
	})

	it('returns high loss when LLM response has wrong shape', async () => {
		const provider = mockProvider(JSON.stringify({ foo: 'bar' }))
		const result = await computeLoss(provider, {
			prompt: 'test',
			output: 'test',
			goal: 'test',
		})
		expect(result.loss).toBe(1)
		expect(result.analysis).toBe(LOSS_FAILURE)
	})

	it('returns high loss on LLM failure', async () => {
		const provider = mockProvider('bad json')
		const result = await computeLoss(provider, {
			prompt: 'test',
			output: 'test',
			goal: 'test',
		})
		expect(result.loss).toBe(1)
	})
})

describe('computeGradient', () => {
	it('returns fallback when LLM response has wrong shape', async () => {
		const provider = mockProvider(JSON.stringify({ foo: 'bar' }))
		const result = await computeGradient(provider, {
			prompt: 'Write a marketing email.',
			lossAnalysis: 'Too generic.',
		})
		expect(result.gradient).toBe(GRADIENT_FAILURE)
		expect(result.suggestedPrompt).toBe('Write a marketing email.')
	})

	it('asks LLM for prompt improvement suggestions', async () => {
		const provider = mockProvider(JSON.stringify({
			gradient: 'Add personalization tokens and urgency language.',
			suggestedPrompt: 'Write a personalized marketing email with urgency.',
		}))

		const result = await computeGradient(provider, {
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
		const provider = mockProvider(improved)

		const result = await applyGradient(provider, {
			currentPrompt: 'Write a marketing email.',
			gradient: 'Add personalization and urgency.',
		})
		expect(result).toContain('personalized')
	})
})
