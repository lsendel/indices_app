import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { loopPipelines, loopRules, loopEvents, loopPromptVersions } from '../db/schema'
import { getDefaultGroups } from '../services/loop/channel-groups'

export function createLoopRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/pipelines', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const items = await db
			.select()
			.from(loopPipelines)
			.where(eq(loopPipelines.tenantId, tenantId))
			.orderBy(desc(loopPipelines.updatedAt))
		return c.json({ pipelines: items })
	})

	router.get('/rules', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const items = await db
			.select()
			.from(loopRules)
			.where(eq(loopRules.tenantId, tenantId))
			.orderBy(loopRules.priority)
		return c.json({ rules: items })
	})

	router.get('/groups', (c) => {
		const groups = getDefaultGroups()
		return c.json({ groups })
	})

	router.get('/events', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const limit = Math.min(Number(c.req.query('limit') || '50'), 200)
		const offset = Number(c.req.query('offset') || '0')

		const items = await db
			.select()
			.from(loopEvents)
			.where(eq(loopEvents.tenantId, tenantId))
			.orderBy(desc(loopEvents.createdAt))
			.limit(limit)
			.offset(offset)
		return c.json({ events: items })
	})

	router.get('/lineage/:channel', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const channel = c.req.param('channel')

		const versions = await db
			.select()
			.from(loopPromptVersions)
			.where(
				and(
					eq(loopPromptVersions.tenantId, tenantId),
					eq(loopPromptVersions.channel, channel),
				),
			)
			.orderBy(desc(loopPromptVersions.version))
		return c.json({ versions })
	})

	return router
}
