import { describe, it, expect } from 'vitest'
import { createOpenAIAdapter } from '../../src/adapters/openai'

describe('OpenAI adapter (deprecated)', () => {
	it('throws when no API key is configured', () => {
		expect(() => createOpenAIAdapter({})).toThrow('OpenAI API key not configured')
	})
})
