import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { getDefaultGroups } from '../services/loop/channel-groups'

export function createLoopRoutes() {
	const router = new Hono<AppEnv>()

	router.get('/pipelines', async (c) => {
		return c.json({ pipelines: [] })
	})

	router.get('/rules', async (c) => {
		return c.json({ rules: [] })
	})

	router.get('/groups', (c) => {
		const groups = getDefaultGroups()
		return c.json({ groups })
	})

	router.get('/events', async (c) => {
		return c.json({ events: [] })
	})

	router.get('/lineage/:channel', async (c) => {
		return c.json({ versions: [] })
	})

	return router
}
