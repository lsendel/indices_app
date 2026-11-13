import { and, eq } from 'drizzle-orm'
import type { Database } from '../../db/client'
import { campaigns } from '../../db/schema'
import type { ZelutoClient } from '../../services/zeluto/client'
import { ZelutoApiError } from '../../types/errors'

/**
 * Read-only: delivery results for an approved campaign that Zeluto sent.
 * Returns nothing for campaigns that are not approved (Zeluto never ingests them).
 */
export async function handleGetCampaignStats(
	db: Database,
	tenantId: string,
	campaignId: string,
	getClient?: (tenantId: string) => Promise<ZelutoClient>,
) {
	const [c] = await db.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
	if (!c) return { error: 'Campaign not found' }
	if (c.approvalStatus !== 'approved') return { error: 'Campaign is not approved, so Zeluto has no results for it' }
	if (!getClient) return { error: 'Zeluto is not configured' }
	try {
		const client = await getClient(tenantId)
		const r = await client.getIndicesCampaignStats(campaignId)
		return {
			id: c.id,
			name: c.name,
			zelutoStatus: r.status,
			pauseReason: r.pauseReason ?? null,
			audienceCount: r.audienceCount ?? null,
			stats: r.stats,
		}
	} catch (err) {
		if (err instanceof ZelutoApiError && err.statusCode === 404) {
			return { id: c.id, name: c.name, zelutoStatus: 'not_ingested', stats: null }
		}
		throw err
	}
}
