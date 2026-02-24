import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { brandKits } from '../db/schema'
import { brandKitCreate } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createBrandAuditRoutes() {
	const router = new Hono<AppEnv>()

	// List brand kits
	router.get('/', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(brandKits)
			.where(eq(brandKits.tenantId, tenantId))
			.orderBy(desc(brandKits.createdAt))

		return c.json({ items })
	})

	// Create brand kit
	router.post('/', validate('json', brandKitCreate), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(brandKits).values({ ...data, tenantId }).returning()
		return c.json(created, 201)
	})

	// Get brand kit detail
	router.get('/:id', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [kit] = await db
			.select()
			.from(brandKits)
			.where(and(eq(brandKits.id, id), eq(brandKits.tenantId, tenantId)))
		if (!kit) throw new NotFoundError('BrandKit', id)

		return c.json(kit)
	})

	// Audit content against brand kit (placeholder for LLM call)
	router.post('/:id/audit', async (c) => {
		const id = c.req.param('id')
		const db = c.var.db
		const tenantId = c.get('tenantId')!

		const [kit] = await db
			.select()
			.from(brandKits)
			.where(and(eq(brandKits.id, id), eq(brandKits.tenantId, tenantId)))
		if (!kit) throw new NotFoundError('BrandKit', id)

		const body = await c.req.json()
		const content = body.content ?? ''

		return c.json({
			kitId: id,
			brandName: kit.brandName,
			content: content.slice(0, 200),
			result: 'Audit requires OPENAI_API_KEY — placeholder response',
			compliant: true,
			issues: [],
		})
	})

	return router
}
