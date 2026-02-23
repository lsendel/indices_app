import { describe, it, expect, vi } from 'vitest'
import { createLLMRouterFromConfig } from '../../../src/adapters/llm/factory'

// Mock all provider constructors
vi.mock('../../../src/adapters/llm/openai', () => ({
	createOpenAIProvider: vi.fn().mockReturnValue({ name: 'openai', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/claude', () => ({
	createClaudeProvider: vi.fn().mockReturnValue({ name: 'claude', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/gemini', () => ({
	createGeminiProvider: vi.fn().mockReturnValue({ name: 'gemini', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/perplexity', () => ({
	createPerplexityProvider: vi.fn().mockReturnValue({ name: 'perplexity', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/grok', () => ({
	createGrokProvider: vi.fn().mockReturnValue({ name: 'grok', capabilities: new Set(['text']) }),
}))
vi.mock('../../../src/adapters/llm/huggingface', () => ({
	createHuggingFaceProvider: vi.fn().mockReturnValue({ name: 'huggingface', capabilities: new Set(['text']) }),
}))

describe('createLLMRouterFromConfig', () => {
	it('should create router with available providers based on config', () => {
		const config = {
			OPENAI_API_KEY: 'sk-test',
			ANTHROPIC_API_KEY: 'sk-ant-test',
		}

		const router = createLLMRouterFromConfig(config as any)
		const providers = router.listProviders()
		expect(providers.map((p) => p.name)).toContain('openai')
		expect(providers.map((p) => p.name)).toContain('claude')
	})

	it('should skip providers without API keys', () => {
		const config = {
			OPENAI_API_KEY: 'sk-test',
		}

		const router = createLLMRouterFromConfig(config as any)
		const providers = router.listProviders()
		expect(providers.map((p) => p.name)).toContain('openai')
		expect(providers.map((p) => p.name)).not.toContain('claude')
	})

	it('should throw when no providers have keys', () => {
		expect(() => createLLMRouterFromConfig({} as any)).toThrow()
	})
})
