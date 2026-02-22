import { Hono } from 'hono'
import { validate } from '../middleware/validate'
import { eq, and, desc } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { experiments, experimentArms } from '../db/schema'
import { getDb } from '../db/client'
import { experimentCreate, armCreate, armReward } from '../types/api'
import { NotFoundError } from '../types/errors'
import { selectArm, updateArm } from '../services/mab/thompson'
import { allocateTraffic } from '../services/mab/allocator'

export function createExperimentRoutes() {
	const router = new Hono<AppEnv>()

	// List experiments
	router.get('/', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!

		const items = await db
			.select()
			.from(experiments)
			.where(eq(experiments.tenantId, tenantId))
			.orderBy(desc(experiments.createdAt))

		return c.json({ items })
	})

	// Create experiment
	router.post('/', validate('json', experimentCreate), async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const data = c.req.valid('json')

		const [created] = await db.insert(experiments).values({ ...data, tenantId }).returning()
		return c.json(created, 201)
	})

	// Get experiment with arms
	router.get('/:id', async (c) => {
		const db = getDb()
		const tenantId = c.get('tenantId')!
		const id = c.req.param('id')

		const [experiment] = await db
			.select()
			.from(experiments)
			.where(and(eq(experiments.id, id), eq(experiments.tenantId, tenantId)))
		if (!experiment) throw new NotFoundError('Experiment', id)

		const arms = await db
			.select()
			.from(experimentArms)
			.where(eq(experimentArms.experimentId, id))

		return c.json({ ...experiment, arms })
	})

	// Add arm to experiment
	router.post('/:id/arms', validate('json', armCreate), async (c) => {
		const db = getDb()
		const id = c.req.param('id')
		const data = c.req.valid('json')

		const [created] = await db
			.insert(experimentArms)
			.values({ ...data, experimentId: id })
			.returning()

		return c.json(created, 201)
	})

	// Get MAB allocation using Thompson Sampling
	router.get('/:id/allocate', async (c) => {
		const db = getDb()
		const id = c.req.param('id')

		const arms = await db
			.select()
			.from(experimentArms)
			.where(eq(experimentArms.experimentId, id))

		if (arms.length === 0) {
			return c.json({ selectedArm: null, allocation: [] })
		}

		const armStates = arms.map((a) => ({ alpha: a.alpha, beta: a.beta }))
		const selectedIdx = selectArm(armStates)
		const allocation = allocateTraffic(armStates)

		return c.json({
			selectedArm: arms[selectedIdx],
			allocation: arms.map((a, i) => ({
				armId: a.id,
				variantName: a.variantName,
				trafficPct: allocation[i],
			})),
		})
	})

	// Record reward for an arm
	router.post('/:id/reward', validate('json', armReward), async (c) => {
		const db = getDb()
		const { armId, success } = c.req.valid('json')

		const [arm] = await db
			.select()
			.from(experimentArms)
			.where(eq(experimentArms.id, armId))
		if (!arm) throw new NotFoundError('Arm', armId)

		const updated = updateArm({ alpha: arm.alpha, beta: arm.beta }, success)

		const [result] = await db
			.update(experimentArms)
			.set({
				alpha: updated.alpha,
				beta: updated.beta,
				impressions: arm.impressions + 1,
				conversions: arm.conversions + (success ? 1 : 0),
				updatedAt: new Date(),
			})
			.where(eq(experimentArms.id, armId))
			.returning()

		return c.json(result)
	})

	return router
}
