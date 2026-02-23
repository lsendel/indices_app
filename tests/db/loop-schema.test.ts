import { describe, it, expect } from 'vitest'
import { loopPipelines } from '../../src/db/schema/loop-pipelines'
import { loopRules } from '../../src/db/schema/loop-rules'
import { loopChannelGroups } from '../../src/db/schema/loop-channel-groups'
import { loopEvents } from '../../src/db/schema/loop-events'

describe('loop schema', () => {
	it('loopPipelines has required columns', () => {
		expect(loopPipelines.id).toBeDefined()
		expect(loopPipelines.tenantId).toBeDefined()
		expect(loopPipelines.name).toBeDefined()
		expect(loopPipelines.eventType).toBeDefined()
		expect(loopPipelines.config).toBeDefined()
		expect(loopPipelines.active).toBeDefined()
	})

	it('loopRules has required columns', () => {
		expect(loopRules.id).toBeDefined()
		expect(loopRules.tenantId).toBeDefined()
		expect(loopRules.conditions).toBeDefined()
		expect(loopRules.actions).toBeDefined()
		expect(loopRules.scope).toBeDefined()
		expect(loopRules.priority).toBeDefined()
	})

	it('loopChannelGroups has required columns', () => {
		expect(loopChannelGroups.id).toBeDefined()
		expect(loopChannelGroups.tenantId).toBeDefined()
		expect(loopChannelGroups.name).toBeDefined()
		expect(loopChannelGroups.type).toBeDefined()
		expect(loopChannelGroups.channels).toBeDefined()
	})

	it('loopEvents has required columns', () => {
		expect(loopEvents.id).toBeDefined()
		expect(loopEvents.tenantId).toBeDefined()
		expect(loopEvents.eventType).toBeDefined()
		expect(loopEvents.payload).toBeDefined()
		expect(loopEvents.outcome).toBeDefined()
	})
})
