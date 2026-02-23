import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { experimentArms } from '../../db/schema'
import { selectArm } from '../../services/mab/thompson'
import { allocateTraffic } from '../../services/mab/allocator'

export async function handleGetExperimentAllocation(experimentId: string, tenantId: string) {
	const db = getDb()
	const arms = await db.select().from(experimentArms).where(eq(experimentArms.experimentId, experimentId))

	if (arms.length === 0) {
		return { experimentId, arms: [], recommendedArm: null, allocation: [] }
	}

	const armStates = arms.map(a => ({ alpha: a.alpha, beta: a.beta }))
	const selectedIdx = selectArm(armStates)
	const allocation = allocateTraffic(armStates)

	return {
		experimentId,
		arms: arms.map((a, i) => ({ id: a.id, variantName: a.variantName, trafficPct: allocation[i], impressions: a.impressions, conversions: a.conversions })),
		recommendedArm: arms[selectedIdx].variantName,
		allocation,
	}
}
