import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { and, eq, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { campaigns, channelResults } from '../db/schema'
import { campaignCreate, paginationQuery } from '../types/api'
import {
	approvalBlockers,
	computeContentHash,
	creativeUpdate,
	isApprover,
	renderCreativePreviewHtml,
} from '../services/campaigns/creative'
import { handleGetCampaignStats } from '../mcp/tools/campaign-stats'
import { getClientForTenant } from './zeluto'
import { ForbiddenError } from '../types/errors'
import { NotFoundError } from '../types/errors'

export function createCampaignRoutes() {
	const router = new Hono<AppEnv>()

	// List campaigns
	router.get('/', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = c.var.db
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
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
		if (!campaign) throw new NotFoundError('Campaign', id)

		const results = await db.select().from(channelResults).where(eq(channelResults.campaignId, id))

		return c.json({ ...campaign, results })
	})

	// Create campaign
	router.post('/', validate('json', campaignCreate), async (c) => {
		const db = c.var.db
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
		const db = c.var.db
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

	// Save the email creative. Any edit clears a previous approval.
	router.put('/:id/creative', validate('json', creativeUpdate), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const data = c.req.valid('json')

		const fields = {
			brandKey: data.brandKey,
			subject: data.subject,
			previewText: data.previewText ?? null,
			bodyHtml: data.bodyHtml ?? null,
			bodyText: data.bodyText,
			audienceSpec: data.audienceSpec ?? null,
		}
		const contentHash = await computeContentHash(fields)

		const [updated] = await db
			.update(campaigns)
			.set({
				...fields,
				contentHash,
				approvalStatus: 'draft',
				approvedBy: null,
				approvedAt: null,
				approvedHash: null,
				updatedAt: new Date(),
			})
			.where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
			.returning()
		if (!updated) throw new NotFoundError('Campaign', id)
		return c.json({ ...updated, blockers: approvalBlockers(updated) })
	})

	// Creative preview (HTML) for review before approval.
	router.get('/:id/preview', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
		if (!campaign) throw new NotFoundError('Campaign', id)
		return c.html(renderCreativePreviewHtml(campaign))
	})

	// Delivery results from Zeluto for an approved campaign (read-only).
	router.get('/:id/stats', async (c) => {
		const result = await handleGetCampaignStats(c.var.db, c.get('tenantId')!, c.req.param('id'), (t) => getClientForTenant(t, c.var.db, c.env))
		if ('error' in result) throw new NotFoundError('Campaign', c.req.param('id'))
		return c.json(result)
	})

	// Approve. Human only: no MCP tool calls this, and the caller must be on the
	// APPROVER_USER_IDS allowlist. Fails closed when the allowlist is unset.
	router.post('/:id/approve', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		const userId = c.get('userId')
		if (!isApprover(userId, c.env.APPROVER_USER_IDS)) {
			throw new ForbiddenError('Only a configured approver can approve campaigns')
		}
		const [campaign] = await db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
		if (!campaign) throw new NotFoundError('Campaign', id)

		const blockers = approvalBlockers(campaign)
		if (blockers.length > 0) return c.json({ error: 'Campaign is not approvable', blockers }, 422)

		const hash = await computeContentHash(campaign)
		const body = await c.req.json<{ contentHash?: string }>().catch(() => ({} as { contentHash?: string }))
		if (!body.contentHash || body.contentHash !== hash) {
			return c.json({ error: 'contentHash must match the current creative (review the latest preview)', contentHash: hash }, 409)
		}

		const [approved] = await db
			.update(campaigns)
			.set({ approvalStatus: 'approved', approvedBy: userId!, approvedAt: new Date(), approvedHash: hash, contentHash: hash, updatedAt: new Date() })
			.where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
			.returning()
		return c.json(approved)
	})

	router.post('/:id/reject', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')
		if (!isApprover(c.get('userId'), c.env.APPROVER_USER_IDS)) {
			throw new ForbiddenError('Only a configured approver can reject campaigns')
		}
		const [rejected] = await db
			.update(campaigns)
			.set({ approvalStatus: 'rejected', approvedBy: null, approvedAt: null, approvedHash: null, updatedAt: new Date() })
			.where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
			.returning()
		if (!rejected) throw new NotFoundError('Campaign', id)
		return c.json(rejected)
	})

	return router
}
