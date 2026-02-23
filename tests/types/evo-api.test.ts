import { describe, it, expect } from 'vitest'
import {
	workflowCreate,
	hitlDecision,
	evolutionStart,
	promptVersionCreate,
} from '../../src/types/api'

describe('evo API schemas', () => {
	it('validates workflowCreate', () => {
		const valid = workflowCreate.safeParse({ goal: 'Launch product email campaign' })
		expect(valid.success).toBe(true)
	})

	it('rejects empty goal', () => {
		const invalid = workflowCreate.safeParse({ goal: '' })
		expect(invalid.success).toBe(false)
	})

	it('validates hitlDecision', () => {
		const valid = hitlDecision.safeParse({
			decision: 'approved',
		})
		expect(valid.success).toBe(true)
	})

	it('validates hitlDecision with modifications', () => {
		const valid = hitlDecision.safeParse({
			decision: 'modified',
			modifications: { systemPrompt: 'Updated prompt' },
		})
		expect(valid.success).toBe(true)
	})

	it('rejects invalid hitl decision value', () => {
		const invalid = hitlDecision.safeParse({ decision: 'maybe' })
		expect(invalid.success).toBe(false)
	})

	it('validates evolutionStart', () => {
		const valid = evolutionStart.safeParse({
			agentConfigId: '550e8400-e29b-41d4-a716-446655440000',
			strategy: 'ga',
			populationSize: 5,
		})
		expect(valid.success).toBe(true)
	})

	it('defaults strategy to hybrid', () => {
		const valid = evolutionStart.safeParse({
			agentConfigId: '550e8400-e29b-41d4-a716-446655440000',
		})
		expect(valid.success).toBe(true)
		expect(valid.data?.strategy).toBe('hybrid')
	})

	it('validates promptVersionCreate', () => {
		const valid = promptVersionCreate.safeParse({
			agentConfigId: '550e8400-e29b-41d4-a716-446655440000',
			systemPrompt: 'You are a marketer.',
			instructionPrompt: 'Write a campaign email.',
		})
		expect(valid.success).toBe(true)
	})
})
