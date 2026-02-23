import { describe, it, expect } from 'vitest'
import type { LLMProvider } from '../../../src/adapters/llm/types'
import { createLLMRouter } from '../../../src/adapters/llm/router'

function mockProvider(name: string): LLMProvider {
	return {
		name,
		capabilities: new Set(['text', 'json']),
		async generateText() { return `from-${name}` },
		async generateJSON() { return { from: name } },
	}
}

describe('LLMRouter', () => {
	it('should resolve provider for a known task', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai'), claude: mockProvider('claude') },
			{ 'content:email': 'claude', 'analysis:sentiment': 'openai' },
		)

		const provider = router.resolve('content:email')
		expect(provider.name).toBe('claude')
	})

	it('should fall back to first available provider for unknown task', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai') },
			{},
		)

		const provider = router.resolve('unknown:task')
		expect(provider.name).toBe('openai')
	})

	it('should fall back when preferred provider is not available', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai') },
			{ 'content:email': 'claude' },
		)

		const provider = router.resolve('content:email')
		expect(provider.name).toBe('openai')
	})

	it('should throw when no providers are available', () => {
		expect(() => createLLMRouter({}, {})).toThrow('No LLM providers')
	})

	it('should list available providers', () => {
		const router = createLLMRouter(
			{ openai: mockProvider('openai'), claude: mockProvider('claude') },
			{},
		)

		const providers = router.listProviders()
		expect(providers).toHaveLength(2)
		expect(providers.map((p) => p.name)).toContain('openai')
		expect(providers.map((p) => p.name)).toContain('claude')
	})
})
