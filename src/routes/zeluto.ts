import { Hono } from 'hono'
import { eq, sql, and, inArray } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { validate } from '../middleware/validate'
import { getDb } from '../db/client'
import { getConfig } from '../config'
import {
	zelutoConfigs,
	syncLogs,
	prospects,
	campaigns,
	experiments,
	experimentArms,
} from '../db/schema'
import {
	zelutoConfigCreate,
	contentSyncRequest,
	contactSyncRequest,
	campaignSyncRequest,
	experimentSyncRequest,
	paginationQuery,
} from '../types/api'
import { NotFoundError } from '../types/errors'
import { ZelutoClient } from '../services/zeluto/client'
import { syncContent } from '../services/zeluto/content-sync'
import { syncCampaign } from '../services/zeluto/campaign-sync'
import { syncExperiment } from '../services/zeluto/experiment-sync'
import { syncContacts, type ProspectData } from '../services/zeluto/contact-sync'

async function getClientForTenant(tenantId: string): Promise<ZelutoClient> {
	const db = getDb()
	const config = getConfig()

	const [zelutoConfig] = await db
		.select()
		.from(zelutoConfigs)
		.where(and(eq(zelutoConfigs.tenantId, tenantId), eq(zelutoConfigs.active, true)))

	if (zelutoConfig) {
		return new ZelutoClient({
			baseUrl: config.ZELUTO_API_URL,
			tenantContext: {
				organizationId: zelutoConfig.organizationId,
				userId: zelutoConfig.userId,
				userRole: zelutoConfig.userRole as any,
				plan: zelutoConfig.plan as any,
			},
			apiKey: config.ZELUTO_API_KEY,
		})
	}

	// Fallback to env var
	if (config.ZELUTO_TENANT_CONTEXT) {
		const ctx = JSON.parse(config.ZELUTO_TENANT_CONTEXT)
		return new ZelutoClient({
			baseUrl: config.ZELUTO_API_URL,
			tenantContext: ctx,
			apiKey: config.ZELUTO_API_KEY,
		})
	}

	throw new NotFoundError('ZelutoConfig', tenantId)
}

async function logSync(
	tenantId: string,
	syncType: string,
	fn: () => Promise<{ externalId?: string; result: unknown }>,
) {
	const db = getDb()
	const [log] = await db
		.insert(syncLogs)
		.values({
			tenantId,
			syncType,
			direction: 'outbound',
			status: 'running',
			startedAt: new Date(),
		})
		.returning()

	try {
		const { externalId, result } = await fn()
		await db
			.update(syncLogs)
			.set({ status: 'completed', externalId, completedAt: new Date() })
			.where(eq(syncLogs.id, log.id))
		return { syncLogId: log.id, result }
	} catch (error) {
		await db
			.update(syncLogs)
			.set({ status: 'failed', error: String(error), completedAt: new Date() })
			.where(eq(syncLogs.id, log.id))
		throw error
	}
}

export function createZelutoRoutes() {
	const router = new Hono<AppEnv>()

	// Save zeluto config for tenant
	router.post('/config', validate('json', zelutoConfigCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [config] = await db
			.insert(zelutoConfigs)
			.values({ ...data, tenantId })
			.onConflictDoUpdate({
				target: zelutoConfigs.tenantId,
				set: { ...data, updatedAt: new Date() },
			})
			.returning()

		return c.json(config, 201)
	})

	// Get zeluto config for tenant
	router.get('/config', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const [config] = await db
			.select()
			.from(zelutoConfigs)
			.where(eq(zelutoConfigs.tenantId, tenantId))

		if (!config) throw new NotFoundError('ZelutoConfig', tenantId)
		return c.json(config)
	})

	// Sync content to zeluto template
	router.post('/sync/content', validate('json', contentSyncRequest), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const client = await getClientForTenant(tenantId)

		const { syncLogId, result } = await logSync(tenantId, 'content', async () => {
			const r = await syncContent(client, data)
			return { externalId: String(r.zelutoTemplateId), result: r }
		})

		return c.json({ ...result, syncLogId }, 201)
	})

	// Sync contacts to zeluto CRM
	router.post('/sync/contacts', validate('json', contactSyncRequest), async (c) => {
		const tenantId = c.get('tenantId')!
		const { prospectIds } = c.req.valid('json')
		const db = getDb()
		const client = await getClientForTenant(tenantId)

		const prospectRows = await db
			.select()
			.from(prospects)
			.where(and(eq(prospects.tenantId, tenantId), inArray(prospects.id, prospectIds)))

		const prospectData: ProspectData[] = prospectRows.map((p) => ({
			name: p.name,
			email: p.email ?? undefined,
			phone: p.phone ?? undefined,
			company: p.company,
			role: p.role,
			linkedinId: p.linkedinId ?? undefined,
		}))

		const { syncLogId, result } = await logSync(tenantId, 'contact', async () => {
			const r = await syncContacts(client, prospectData)
			return { result: r }
		})

		return c.json({ ...result, syncLogId }, 201)
	})

	// Sync campaign to zeluto
	router.post('/sync/campaign', validate('json', campaignSyncRequest), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const db = getDb()
		const client = await getClientForTenant(tenantId)

		const [campaign] = await db
			.select()
			.from(campaigns)
			.where(and(eq(campaigns.id, data.campaignId), eq(campaigns.tenantId, tenantId)))

		if (!campaign) throw new NotFoundError('Campaign', data.campaignId)

		const { syncLogId, result } = await logSync(tenantId, 'campaign', async () => {
			const r = await syncCampaign(client, {
				name: campaign.name,
				goal: campaign.goal,
				channels: (campaign.channelsRequested as string[]) ?? ['email'],
				action: data.action,
				scheduledAt: data.scheduledAt,
			})
			return { externalId: String(r.zelutoCampaignId), result: r }
		})

		return c.json({ ...result, syncLogId }, 201)
	})

	// Sync experiment to zeluto A/B test
	router.post('/sync/experiment', validate('json', experimentSyncRequest), async (c) => {
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')
		const db = getDb()
		const client = await getClientForTenant(tenantId)

		const [experiment] = await db
			.select()
			.from(experiments)
			.where(and(eq(experiments.id, data.experimentId), eq(experiments.tenantId, tenantId)))

		if (!experiment) throw new NotFoundError('Experiment', data.experimentId)

		const arms = await db
			.select()
			.from(experimentArms)
			.where(eq(experimentArms.experimentId, data.experimentId))

		const { syncLogId, result } = await logSync(tenantId, 'experiment', async () => {
			const r = await syncExperiment(client, {
				experimentName: experiment.name,
				zelutoCampaignId: data.zelutoCampaignId,
				arms: arms.map((a) => ({
					id: a.id,
					variantName: a.variantName,
					content: (a.content as Record<string, unknown>) ?? {},
					trafficPct: a.trafficPct,
				})),
				winningCriteria: data.winningCriteria,
			})
			return { externalId: String(r.zelutoAbTestId), result: r }
		})

		return c.json({ ...result, syncLogId }, 201)
	})

	// List sync logs
	router.get('/sync/logs', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit

		const [items, countResult] = await Promise.all([
			db
				.select()
				.from(syncLogs)
				.where(eq(syncLogs.tenantId, tenantId))
				.limit(limit)
				.offset(offset)
				.orderBy(syncLogs.createdAt),
			db
				.select({ count: sql<number>`count(*)` })
				.from(syncLogs)
				.where(eq(syncLogs.tenantId, tenantId)),
		])

		return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
	})

	return router
}
