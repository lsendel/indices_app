import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { campaigns } from '../db/schema'
import { computeContentHash, timingSafeEqual } from '../services/campaigns/creative'
import { NotFoundError, UnauthorizedError } from '../types/errors'

/**
 * Service-to-service pull for Zeluto. Zeluto fetches approved creative; it
 * never receives anything that is not approved, and every item carries the
 * approved hash so Zeluto can verify the content it renders.
 * Auth: bearer ZELUTO_PULL_TOKEN, scoped to ZELUTO_PULL_TENANT_ID. Fails closed.
 */
export function createZelutoPullRoutes() {
	const router = new Hono<AppEnv>()

	router.use('*', async (c, next) => {
		const token = c.env.ZELUTO_PULL_TOKEN
		const tenant = c.env.ZELUTO_PULL_TENANT_ID
		const header = c.req.header('authorization') ?? ''
		const presented = header.startsWith('Bearer ') ? header.slice(7) : ''
		if (!token || !tenant || !presented || !timingSafeEqual(presented, token)) {
			throw new UnauthorizedError('Invalid pull credentials')
		}
		await next()
	})

	function shape(row: typeof campaigns.$inferSelect) {
		return {
			id: row.id,
			name: row.name,
			brandKey: row.brandKey,
			subject: row.subject,
			previewText: row.previewText,
			bodyHtml: row.bodyHtml,
			bodyText: row.bodyText,
			audienceSpec: row.audienceSpec,
			approvedBy: row.approvedBy,
			approvedAt: row.approvedAt,
			approvedHash: row.approvedHash,
		}
	}

	async function verified(row: typeof campaigns.$inferSelect) {
		if (row.approvalStatus !== 'approved' || !row.approvedHash) return false
		return (await computeContentHash(row)) === row.approvedHash
	}

	router.get('/approved-campaigns', async (c) => {
		const tenantId = c.env.ZELUTO_PULL_TENANT_ID!
		const rows = await c.var.db
			.select()
			.from(campaigns)
			.where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.approvalStatus, 'approved')))
		const items = []
		for (const row of rows) if (await verified(row)) items.push(shape(row))
		return c.json({ items })
	})

	router.get('/approved-campaigns/:id', async (c) => {
		const tenantId = c.env.ZELUTO_PULL_TENANT_ID!
		const id = c.req.param('id')
		const [row] = await c.var.db.select().from(campaigns).where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
		if (!row || !(await verified(row))) throw new NotFoundError('Approved campaign', id)
		return c.json(shape(row))
	})

	return router
}
