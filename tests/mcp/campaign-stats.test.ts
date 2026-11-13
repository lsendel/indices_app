import { describe, it, expect, vi } from 'vitest'
import { handleGetCampaignStats } from '../../src/mcp/tools/campaign-stats'
import { ZelutoApiError } from '../../src/types/errors'
import { getMcpToolNames } from '../../src/mcp/server'

function dbWith(row: Record<string, unknown> | null) {
	return { select: () => ({ from: () => ({ where: () => Promise.resolve(row ? [row] : []) }) }) } as any
}
const approved = { id: 'c1', name: 'Pilot', approvalStatus: 'approved' }
const stats = { indicesCampaignId: 'c1', audienceCount: 15, status: 'sent', pauseReason: null, stats: { sent: 15, delivered: 14, bounced: 0, complained: 0, unsubscribed: 1, opened: 3, clicked: 1, bounceRate: 0, complaintRate: 0 } }

describe('get_campaign_stats', () => {
	it('is registered', () => {
		expect(getMcpToolNames()).toContain('get_campaign_stats')
	})
	it('returns Zeluto rollup for an approved campaign', async () => {
		const getIndicesCampaignStats = vi.fn().mockResolvedValue(stats)
		const r: any = await handleGetCampaignStats(dbWith(approved), 't1', 'c1', async () => ({ getIndicesCampaignStats }) as any)
		expect(getIndicesCampaignStats).toHaveBeenCalledWith('c1')
		expect(r.stats.delivered).toBe(14)
		expect(r.zelutoStatus).toBe('sent')
	})
	it('does not call Zeluto for unapproved or missing campaigns', async () => {
		const getClient = vi.fn()
		expect(await handleGetCampaignStats(dbWith({ ...approved, approvalStatus: 'draft' }), 't1', 'c1', getClient)).toHaveProperty('error')
		expect(await handleGetCampaignStats(dbWith(null), 't1', 'c1', getClient)).toHaveProperty('error')
		expect(getClient).not.toHaveBeenCalled()
	})
	it('reports not_ingested on a Zeluto 404', async () => {
		const client = { getIndicesCampaignStats: vi.fn().mockRejectedValue(new ZelutoApiError('NOT_FOUND', 'x', 404)) }
		const r: any = await handleGetCampaignStats(dbWith(approved), 't1', 'c1', async () => client as any)
		expect(r.zelutoStatus).toBe('not_ingested')
	})
})
