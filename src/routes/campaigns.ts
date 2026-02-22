import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { and, eq, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { campaigns, channelResults } from '../db/schema'
import { getDb } from '../db/client'
import { campaignCreate, paginationQuery } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createCampaignRoutes() {
	const router = new Hono<AppEnv>()

	// List campaigns
	router.get('/', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit

		const [items, countResult] = await Promise.all([
			db.select().from(campaigns).where(eq(campaigns.tenantId, tenantId)).limit(limit).offset(offset).orderBy(campaigns.createdAt),
			db.select({ count: sql<number>`count(*)` }).from(campaigns).where(eq(campaigns.tenantId, tenantId)),
		])

		return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
	})

	// Get campaign with channel results
	router.get('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
		if (!campaign) throw new NotFoundError('Campaign', id)

		const results = await db.select().from(channelResults).where(eq(channelResults.campaignId, id))

		return c.json({ ...campaign, results })
	})

	// Create campaign
	router.post('/', validate('json', campaignCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db
			.insert(campaigns)
			.values({
				tenantId,
				name: data.name,
				goal: data.goal,
				productDescription: data.productDescription,
				channelsRequested: data.channels,
				metadata: data.metadata ?? {},
			})
			.returning()

		return c.json(created, 201)
	})

	// Update campaign status
	router.patch('/:id/status', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const body = await c.req.json<{ status: string }>()

		const [updated] = await db
			.update(campaigns)
			.set({ status: body.status, updatedAt: new Date() })
			.where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
			.returning()
		if (!updated) throw new NotFoundError('Campaign', id)
		return c.json(updated)
	})

	return router
}
