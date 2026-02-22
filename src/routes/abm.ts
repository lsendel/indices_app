import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { eq, and, sql, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { accounts, deals } from '../db/schema'
import { getDb } from '../db/client'
import { accountCreate, dealCreate, paginationQuery } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createAbmRoutes() {
	const router = new Hono<AppEnv>()

	// List accounts
	router.get('/', async (c) => {
		const { page, limit } = paginationQuery.parse(c.req.query())
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const offset = (page - 1) * limit

		const [items, countResult] = await Promise.all([
			db.select().from(accounts).where(eq(accounts.tenantId, tenantId)).limit(limit).offset(offset).orderBy(desc(accounts.score)),
			db.select({ count: sql<number>`count(*)` }).from(accounts).where(eq(accounts.tenantId, tenantId)),
		])

		return c.json({ items, total: countResult[0]?.count ?? 0, page, limit })
	})

	// Create account
	router.post('/', validate('json', accountCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(accounts).values({ ...data, tenantId }).returning()
		return c.json(created, 201)
	})

	// Get account with deals
	router.get('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.tenantId, tenantId)))
		if (!account) throw new NotFoundError('Account', id)

		const accountDeals = await db.select().from(deals).where(eq(deals.accountId, id))
		return c.json({ ...account, deals: accountDeals })
	})

	// Create deal
	router.post('/deals', validate('json', dealCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(deals).values({ ...data, tenantId }).returning()
		return c.json(created, 201)
	})

	return router
}
