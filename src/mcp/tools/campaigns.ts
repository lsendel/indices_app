import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '../../db/client'
import { campaigns } from '../../db/schema'
import {
	approvalBlockers,
	computeContentHash,
	creativeUpdate,
	type CreativeUpdate,
} from '../../services/campaigns/creative'

/**
 * MCP tools create and edit draft creative only. There is intentionally no
 * approve tool: approval is a human action on the REST route.
 */

export async function handleCreateCampaignDraft(
	db: Database,
	tenantId: string,
	input: { name: string; goal: string; creative: CreativeUpdate },
) {
	const creative = creativeUpdate.parse(input.creative)
	const fields = {
		brandKey: creative.brandKey,
		subject: creative.subject,
		previewText: creative.previewText ?? null,
		bodyHtml: creative.bodyHtml ?? null,
		bodyText: creative.bodyText,
		audienceSpec: creative.audienceSpec ?? null,
	}
	const [created] = await db
		.insert(campaigns)
		.values({
			tenantId,
			name: input.name,
			goal: input.goal,
			channelsRequested: ['email'],
			...fields,
			contentHash: await computeContentHash(fields),
			approvalStatus: 'draft',
		})
		.returning()
	return { id: created.id, approvalStatus: created.approvalStatus, contentHash: created.contentHash, blockers: approvalBlockers(created) }
}

export async function handleUpdateCampaignCreative(db: Database, tenantId: string, campaignId: string, input: CreativeUpdate) {
	const creative = creativeUpdate.parse(input)
	const fields = {
		brandKey: creative.brandKey,
		subject: creative.subject,
		previewText: creative.previewText ?? null,
		bodyHtml: creative.bodyHtml ?? null,
		bodyText: creative.bodyText,
		audienceSpec: creative.audienceSpec ?? null,
	}
	const [updated] = await db
		.update(campaigns)
		.set({
			...fields,
			contentHash: await computeContentHash(fields),
			approvalStatus: 'draft',
			approvedBy: null,
			approvedAt: null,
			approvedHash: null,
			updatedAt: new Date(),
		})
		.where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
		.returning()
	if (!updated) return { error: 'Campaign not found' }
	return { id: updated.id, approvalStatus: updated.approvalStatus, contentHash: updated.contentHash, blockers: approvalBlockers(updated) }
}

export async function handleGetCampaignPreview(db: Database, tenantId: string, campaignId: string) {
	const [c] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
	if (!c) return { error: 'Campaign not found' }
	return {
		id: c.id,
		name: c.name,
		approvalStatus: c.approvalStatus,
		contentHash: c.contentHash,
		brandKey: c.brandKey,
		subject: c.subject,
		previewText: c.previewText,
		bodyText: c.bodyText,
		audienceSpec: c.audienceSpec,
		blockers: approvalBlockers(c),
		previewPath: `/api/v1/campaigns/${c.id}/preview`,
	}
}

export async function handleListCampaigns(db: Database, tenantId: string, limit = 20) {
	const rows = await db
		.select({ id: campaigns.id, name: campaigns.name, approvalStatus: campaigns.approvalStatus, brandKey: campaigns.brandKey, updatedAt: campaigns.updatedAt })
		.from(campaigns)
		.where(eq(campaigns.tenantId, tenantId))
		.orderBy(desc(campaigns.updatedAt))
		.limit(limit)
	return { items: rows }
}
