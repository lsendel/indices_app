import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { personaProfiles } from '../db/schema'
import { personaCreate } from '../types/api'
import { NotFoundError } from '../types/errors'

export function createPersonaRoutes() {
	const router = new Hono<AppEnv>()

	// List personas
	router.get('/', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(personaProfiles)
			.where(eq(personaProfiles.tenantId, tenantId))
			.orderBy(desc(personaProfiles.createdAt))

		return c.json({ items })
	})

	// Create persona
	router.post('/', validate('json', personaCreate), async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(personaProfiles).values({ ...data, tenantId }).returning()
		return c.json(created, 201)
	})

	// Get persona detail
	router.get('/:id', async (c) => {
		const db = c.var.db
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [persona] = await db
			.select()
			.from(personaProfiles)
			.where(and(eq(personaProfiles.id, id), eq(personaProfiles.tenantId, tenantId)))
		if (!persona) throw new NotFoundError('Persona', id)

		return c.json(persona)
	})

	return router
}
