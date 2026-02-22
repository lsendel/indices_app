import { describe, it, expect } from 'vitest'
import { syncLogs } from '../../src/db/schema/sync-log'
import { zelutoConfigs } from '../../src/db/schema/zeluto-config'
import { deliveryEvents } from '../../src/db/schema/delivery-events'

describe('sync log schema', () => {
	it('syncLogs has required columns', () => {
		expect(syncLogs.id).toBeDefined()
		expect(syncLogs.tenantId).toBeDefined()
		expect(syncLogs.syncType).toBeDefined()
		expect(syncLogs.direction).toBeDefined()
		expect(syncLogs.status).toBeDefined()
		expect(syncLogs.resourceId).toBeDefined()
		expect(syncLogs.externalId).toBeDefined()
		expect(syncLogs.error).toBeDefined()
		expect(syncLogs.createdAt).toBeDefined()
	})
})

describe('zeluto config schema', () => {
	it('zelutoConfigs has required columns', () => {
		expect(zelutoConfigs.id).toBeDefined()
		expect(zelutoConfigs.tenantId).toBeDefined()
		expect(zelutoConfigs.organizationId).toBeDefined()
		expect(zelutoConfigs.userId).toBeDefined()
		expect(zelutoConfigs.userRole).toBeDefined()
		expect(zelutoConfigs.plan).toBeDefined()
		expect(zelutoConfigs.webhookSecret).toBeDefined()
		expect(zelutoConfigs.active).toBeDefined()
	})
})

describe('delivery events schema', () => {
	it('deliveryEvents has required columns', () => {
		expect(deliveryEvents.id).toBeDefined()
		expect(deliveryEvents.tenantId).toBeDefined()
		expect(deliveryEvents.zelutoJobId).toBeDefined()
		expect(deliveryEvents.campaignId).toBeDefined()
		expect(deliveryEvents.channel).toBeDefined()
		expect(deliveryEvents.eventType).toBeDefined()
		expect(deliveryEvents.contactEmail).toBeDefined()
		expect(deliveryEvents.eventData).toBeDefined()
		expect(deliveryEvents.occurredAt).toBeDefined()
	})
})
