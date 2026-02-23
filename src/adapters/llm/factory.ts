import type { Config } from '../../config'
import type { LLMProvider } from './types'
import { createLLMRouter, type LLMRouter } from './router'
import { createOpenAIProvider } from './openai'
import { createClaudeProvider } from './claude'
import { createGeminiProvider } from './gemini'
import { createPerplexityProvider } from './perplexity'
import { createGrokProvider } from './grok'
import { createHuggingFaceProvider } from './huggingface'

const DEFAULT_ROUTING: Record<string, string> = {
	'content:email': 'claude',
	'content:sms': 'openai',
	'content:voice': 'claude',
	'content:whatsapp': 'openai',
	'content:linkedin': 'claude',
	'content:facebook': 'openai',
	'content:instagram': 'openai',
	'content:tiktok': 'gemini',
	'content:youtube': 'gemini',
	'content:vimeo': 'gemini',
	'content:video': 'gemini',
	'research:competitive': 'perplexity',
	'research:trending': 'grok',
	'analysis:sentiment': 'openai',
	'analysis:persona': 'claude',
}

export function createLLMRouterFromConfig(config: Config): LLMRouter {
	const providers: Record<string, LLMProvider> = {}

	if (config.OPENAI_API_KEY) {
		providers.openai = createOpenAIProvider(config.OPENAI_API_KEY, config.OPENAI_MODEL)
	}
	if (config.ANTHROPIC_API_KEY) {
		providers.claude = createClaudeProvider(config.ANTHROPIC_API_KEY)
	}
	if (config.GEMINI_API_KEY) {
		providers.gemini = createGeminiProvider(config.GEMINI_API_KEY)
	}
	if (config.PERPLEXITY_API_KEY) {
		providers.perplexity = createPerplexityProvider(config.PERPLEXITY_API_KEY)
	}
	if (config.GROK_API_KEY) {
		providers.grok = createGrokProvider(config.GROK_API_KEY)
	}
	if (config.HUGGINGFACE_API_KEY) {
		providers.huggingface = createHuggingFaceProvider(config.HUGGINGFACE_API_KEY)
	}

	return createLLMRouter(providers, DEFAULT_ROUTING)
}
