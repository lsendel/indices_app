import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { contentGenerate, contentGenerateBatch } from '../types/api'
import { channelConfig, SUPPORTED_CHANNELS } from '../adapters/channels'
import { generateForChannel } from '../adapters/channels'

export function createContentRoutes() {
	const app = new Hono<AppEnv>()

	app.get('/providers', async (c) => {
		const { createLLMRouterFromConfig } = await import('../adapters/llm/factory')
		const { getConfig } = await import('../config')
		try {
			const router = createLLMRouterFromConfig(getConfig())
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
		const { channel, brief, provider } = c.req.valid('json' as never)
		const { createLLMRouterFromConfig } = await import('../adapters/llm/factory')
		const { getConfig } = await import('../config')
		const router = createLLMRouterFromConfig(getConfig())
		const result = await generateForChannel(channel, brief, router, provider)
		return c.json({ channel, content: result })
	})

	app.post('/generate/batch', validate('json', contentGenerateBatch), async (c) => {
		const { channels, brief } = c.req.valid('json' as never)
		const { createLLMRouterFromConfig } = await import('../adapters/llm/factory')
		const { getConfig } = await import('../config')
		const router = createLLMRouterFromConfig(getConfig())
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
