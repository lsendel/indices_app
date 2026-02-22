import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { auditLogs } from '../db/schema'
import { getDb } from '../db/client'
import { paginationQuery } from '../types/api'

export function createComplianceRoutes() {
	const router = new Hono<AppEnv>()

	// List audit logs
	router.get('/logs', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit

		const [items, countResult] = await Promise.all([
			db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenantId)).limit(limit).offset(offset).orderBy(auditLogs.createdAt),
			db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(eq(auditLogs.tenantId, tenantId)),
		])

		return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
	})

	return router
}
