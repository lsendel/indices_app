import { describe, it, expect, vi } from 'vitest'
import {
	crossoverPrompts,
	mutatePrompt,
	deMutatePrompt,
	selectParents,
	createScoredPrompt,
} from '../../../src/services/evo/prompt-population'
import type { OpenAIAdapter } from '../../../src/adapters/openai'

function mockAdapter(response: string): OpenAIAdapter {
	return {
		analyzeSentiment: vi.fn(),
		generateContent: vi.fn().mockResolvedValue(response),
	}
}

describe('selectParents', () => {
	it('selects top-scoring candidates as parents (truncation selection)', () => {
		const population = [
			{ prompt: 'a', score: 0.3 },
			{ prompt: 'b', score: 0.9 },
			{ prompt: 'c', score: 0.7 },
			{ prompt: 'd', score: 0.5 },
		]
		const parents = selectParents(population, 2)
		expect(parents).toHaveLength(2)
		expect(parents[0].score).toBeGreaterThanOrEqual(parents[1].score)
	})

	it('returns all if count >= population', () => {
		const pop = [{ prompt: 'a', score: 0.5 }]
		expect(selectParents(pop, 3)).toHaveLength(1)
	})
})

describe('crossoverPrompts', () => {
	it('combines two parent prompts via LLM', async () => {
		const adapter = mockAdapter('A hybrid prompt combining audience focus with urgency.')
		const child = await crossoverPrompts(adapter, 'Focus on audience needs.', 'Use urgency in messaging.')
		expect(child).toContain('hybrid')
	})
})

describe('mutatePrompt', () => {
	it('mutates a prompt via LLM', async () => {
		const adapter = mockAdapter('Focus on audience needs with emotional hooks and social proof.')
		const mutated = await mutatePrompt(adapter, 'Focus on audience needs.')
		expect(mutated).toContain('emotional')
	})
})

describe('createScoredPrompt', () => {
	it('clamps score to [0, 1] range', () => {
		expect(createScoredPrompt('p', 1.5).score).toBe(1)
		expect(createScoredPrompt('p', -0.3).score).toBe(0)
		expect(createScoredPrompt('p', 0.7).score).toBe(0.7)
	})
})

describe('deMutatePrompt', () => {
	it('applies DE-inspired mutation via LLM', async () => {
		const adapter = mockAdapter('Target prompt enhanced with innovations from donor differences.')
		const result = await deMutatePrompt(adapter, {
			target: 'Basic prompt.',
			donor1: 'Prompt with feature A.',
			donor2: 'Prompt without feature A.',
		})
		expect(result).toContain('innovations')
	})
})
