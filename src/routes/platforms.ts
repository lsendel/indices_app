import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { platformConnections } from '../db/schema'
import { wordpressConnect, blogConnect } from '../types/api'
import { buildOAuthUrl, exchangeCodeForTokens, fetchAccountInfo } from '../adapters/platforms/oauth'
import { NotFoundError } from '../types/errors'

export function createPlatformRoutes() {
	const router = new Hono<AppEnv>()

	// List connected platforms
	router.get('/', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const items = await db
			.select()
			.from(platformConnections)
			.where(eq(platformConnections.tenantId, tenantId))
			.orderBy(desc(platformConnections.createdAt))
		return c.json({ items })
	})

	// OAuth-based connect (Instagram, Facebook, TikTok, LinkedIn)
	router.post('/:platform/connect', async (c) => {
		const platform = c.req.param('platform')
		const db = c.var.db
		const tenantId = c.get('tenantId')!

		// WordPress — direct credentials
		if (platform === 'wordpress') {
			const body = wordpressConnect.parse(await c.req.json())
			const [created] = await db
				.insert(platformConnections)
				.values({
					tenantId,
					platform: 'wordpress',
					accessToken: body.appPassword,
					metadata: { siteUrl: body.siteUrl, username: body.username },
				})
				.returning()
			return c.json(created, 201)
		}

		// Blog — webhook config
		if (platform === 'blog') {
			const body = blogConnect.parse(await c.req.json())
			const [created] = await db
				.insert(platformConnections)
				.values({
					tenantId,
					platform: 'blog',
					accessToken: body.apiKey || '',
					metadata: { webhookUrl: body.webhookUrl, headers: body.headers },
				})
				.returning()
			return c.json(created, 201)
		}

		// OAuth platforms
		const providers: Record<string, { provider: string; clientId: string; scopes: string[] }> = {
			instagram: { provider: 'meta', clientId: c.env.META_APP_ID || '', scopes: ['instagram_basic', 'instagram_content_publish'] },
			facebook: { provider: 'meta', clientId: c.env.META_APP_ID || '', scopes: ['pages_manage_posts', 'pages_read_engagement'] },
			whatsapp: { provider: 'meta', clientId: c.env.META_APP_ID || '', scopes: ['whatsapp_business_messaging'] },
			tiktok: { provider: 'tiktok', clientId: c.env.TIKTOK_CLIENT_KEY || '', scopes: ['video.publish', 'video.list'] },
			linkedin: { provider: 'linkedin', clientId: c.env.LINKEDIN_CLIENT_ID || '', scopes: ['w_member_social', 'r_liteprofile'] },
		}

		const providerConfig = providers[platform]
		if (!providerConfig) return c.json({ error: 'Unsupported platform' }, 400)

		const redirectUri = `${c.env.BETTER_AUTH_URL}/api/v1/platforms/${platform}/callback`
		const state = crypto.randomUUID()

		const url = buildOAuthUrl(providerConfig.provider, {
			clientId: providerConfig.clientId,
			redirectUri,
			scopes: providerConfig.scopes,
			state,
		})

		return c.json({ authUrl: url, state })
	})

	// OAuth callback
	router.get('/:platform/callback', async (c) => {
		const platform = c.req.param('platform')
		const code = c.req.query('code')
		if (!code) return c.json({ error: 'Missing authorization code' }, 400)

		const db = c.var.db
		const tenantId = c.get('tenantId')!

		const secrets: Record<string, { provider: string; clientId: string; clientSecret: string }> = {
			instagram: { provider: 'meta', clientId: c.env.META_APP_ID || '', clientSecret: c.env.META_APP_SECRET || '' },
			facebook: { provider: 'meta', clientId: c.env.META_APP_ID || '', clientSecret: c.env.META_APP_SECRET || '' },
			whatsapp: { provider: 'meta', clientId: c.env.META_APP_ID || '', clientSecret: c.env.META_APP_SECRET || '' },
			tiktok: { provider: 'tiktok', clientId: c.env.TIKTOK_CLIENT_KEY || '', clientSecret: c.env.TIKTOK_CLIENT_SECRET || '' },
			linkedin: { provider: 'linkedin', clientId: c.env.LINKEDIN_CLIENT_ID || '', clientSecret: c.env.LINKEDIN_CLIENT_SECRET || '' },
		}

		const secretConfig = secrets[platform]
		if (!secretConfig) return c.json({ error: 'Unsupported platform' }, 400)

		const redirectUri = `${c.env.BETTER_AUTH_URL}/api/v1/platforms/${platform}/callback`
		const tokens = await exchangeCodeForTokens(
			secretConfig.provider,
			code,
			secretConfig.clientId,
			secretConfig.clientSecret,
			redirectUri,
		)

		// Fetch account info from the platform API
		const accountInfo = await fetchAccountInfo(secretConfig.provider, tokens.accessToken)

		const [created] = await db
			.insert(platformConnections)
			.values({
				tenantId,
				platform: platform as any,
				accessToken: tokens.accessToken,
				refreshToken: tokens.refreshToken,
				expiresAt: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : undefined,
				metadata: accountInfo,
			})
			.returning()

		return c.json(created, 201)
	})

	// Disconnect
	router.delete('/:platform', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const platform = c.req.param('platform')
		const [deleted] = await db
			.delete(platformConnections)
			.where(and(eq(platformConnections.tenantId, tenantId), eq(platformConnections.platform, platform as any)))
			.returning()
		if (!deleted) throw new NotFoundError('PlatformConnection', platform)
		return c.json({ deleted: true, id: deleted.id })
	})

	return router
}
