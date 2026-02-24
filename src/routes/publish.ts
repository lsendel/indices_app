import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { platformConnections, publishedContent } from '../db/schema'
import { publishRequest, publishBatchRequest, paginationQuery } from '../types/api'
import { publishContent } from '../services/publishing/publisher'
import { NotFoundError } from '../types/errors'

export function createPublishRoutes() {
	const router = new Hono<AppEnv>()

	// Publish to a single platform
	router.post('/', validate('json', publishRequest), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		// Find connection for this platform
		const [connection] = await db
			.select()
			.from(platformConnections)
			.where(and(eq(platformConnections.tenantId, tenantId), eq(platformConnections.platform, data.platform)))

		if (!connection) throw new NotFoundError('PlatformConnection', data.platform)

		const result = await publishContent({
			platform: data.platform,
			channel: data.channel,
			content: data.content,
			connection: {
				id: connection.id,
				tenantId: connection.tenantId,
				platform: connection.platform as any,
				accessToken: connection.accessToken,
				refreshToken: connection.refreshToken ?? undefined,
				expiresAt: connection.expiresAt ?? undefined,
				scopes: connection.scopes ?? undefined,
				metadata: connection.metadata as Record<string, unknown>,
			},
			campaignId: data.campaignId,
			tenantId,
		})

		// Store in published_content
		await db.insert(publishedContent).values({
			tenantId,
			platform: data.platform,
			channel: data.channel,
			platformContentId: result.platformContentId,
			platformUrl: result.url,
			content: data.content,
			status: result.status === 'published' ? 'published' : result.status === 'processing' ? 'processing' : 'draft',
			publishedAt: result.status === 'published' ? new Date() : undefined,
			campaignId: data.campaignId,
		})

		return c.json(result, 201)
	})

	// Batch publish to multiple platforms
	router.post('/batch', validate('json', publishBatchRequest), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const results = await Promise.allSettled(
			data.platforms.map(async (platform) => {
				const [connection] = await db
					.select()
					.from(platformConnections)
					.where(and(eq(platformConnections.tenantId, tenantId), eq(platformConnections.platform, platform)))

				if (!connection) return { platform, error: 'Not connected' }

				const result = await publishContent({
					platform,
					channel: data.channel,
					content: data.content,
					connection: {
						id: connection.id,
						tenantId: connection.tenantId,
						platform: connection.platform as any,
						accessToken: connection.accessToken,
						refreshToken: connection.refreshToken ?? undefined,
						metadata: connection.metadata as Record<string, unknown>,
					},
					campaignId: data.campaignId,
					tenantId,
				})

				return { platform, ...result }
			}),
		)

		return c.json({
			results: results.map((r) =>
				r.status === 'fulfilled' ? r.value : { error: (r.reason as Error).message },
			),
		})
	})

	// Publish history
	router.get('/history', validate('query', paginationQuery), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const { page, limit } = c.req.valid('query')
		const offset = (page - 1) * limit

		const items = await db
			.select()
			.from(publishedContent)
			.where(eq(publishedContent.tenantId, tenantId))
			.orderBy(desc(publishedContent.createdAt))
			.limit(limit)
			.offset(offset)

		return c.json({ items, page, limit })
	})

	return router
}
