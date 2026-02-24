import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { contentGenerate, contentGenerateBatch } from '../types/api'
import { channelConfig, SUPPORTED_CHANNELS } from '../adapters/channels'
import { generateForChannel } from '../adapters/channels'
import { createLLMRouterFromConfig } from '../adapters/llm/factory'

export function createContentRoutes() {
	const app = new Hono<AppEnv>()

	app.get('/providers', async (c) => {
		try {
			const config = {
				OPENAI_API_KEY: c.env.OPENAI_API_KEY,
				OPENAI_MODEL: c.env.OPENAI_MODEL || 'gpt-4o',
				ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
				GEMINI_API_KEY: c.env.GEMINI_API_KEY,
				PERPLEXITY_API_KEY: c.env.PERPLEXITY_API_KEY,
				GROK_API_KEY: c.env.GROK_API_KEY,
				HUGGINGFACE_API_KEY: c.env.HUGGINGFACE_API_KEY,
			} as any
			const router = createLLMRouterFromConfig(config)
			const providers = router.listProviders().map((p) => ({
				name: p.name,
				capabilities: [...p.capabilities],
			}))
			return c.json({ providers })
		} catch {
			return c.json({ providers: [] })
		}
	})

	app.get('/channels', (c) => {
		const channels = SUPPORTED_CHANNELS.map((name) => ({
			name,
			...channelConfig[name],
		}))
		return c.json({ channels })
	})

	app.post('/generate', validate('json', contentGenerate), async (c) => {
		const { channel, brief, provider } = c.req.valid('json' as never) as { channel: string; brief: string; provider?: string }
		const config = {
			OPENAI_API_KEY: c.env.OPENAI_API_KEY,
			OPENAI_MODEL: c.env.OPENAI_MODEL || 'gpt-4o',
			ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
			GEMINI_API_KEY: c.env.GEMINI_API_KEY,
			PERPLEXITY_API_KEY: c.env.PERPLEXITY_API_KEY,
			GROK_API_KEY: c.env.GROK_API_KEY,
			HUGGINGFACE_API_KEY: c.env.HUGGINGFACE_API_KEY,
		} as any
		const router = createLLMRouterFromConfig(config)
		const result = await generateForChannel(channel, brief, router, provider)
		return c.json({ channel, content: result })
	})

	app.post('/generate/batch', validate('json', contentGenerateBatch), async (c) => {
		const { channels, brief } = c.req.valid('json' as never) as { channels: string[]; brief: string }
		const config = {
			OPENAI_API_KEY: c.env.OPENAI_API_KEY,
			OPENAI_MODEL: c.env.OPENAI_MODEL || 'gpt-4o',
			ANTHROPIC_API_KEY: c.env.ANTHROPIC_API_KEY,
			GEMINI_API_KEY: c.env.GEMINI_API_KEY,
			PERPLEXITY_API_KEY: c.env.PERPLEXITY_API_KEY,
			GROK_API_KEY: c.env.GROK_API_KEY,
			HUGGINGFACE_API_KEY: c.env.HUGGINGFACE_API_KEY,
		} as any
		const router = createLLMRouterFromConfig(config)
		const results: Record<string, unknown> = {}

		await Promise.all(
			channels.map(async (channel: string) => {
				results[channel] = await generateForChannel(channel, brief, router)
			}),
		)

		return c.json({ results })
	})

	return app
}
