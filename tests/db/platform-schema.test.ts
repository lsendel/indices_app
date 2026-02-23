import { describe, it, expect } from 'vitest'
import { platformConnections } from '../../src/db/schema/platform-connections'
import { publishedContent } from '../../src/db/schema/published-content'
import { engagementEvents } from '../../src/db/schema/engagement-events'

describe('Platform schema', () => {
	it('platformConnections should have required columns', () => {
		expect(platformConnections.id).toBeDefined()
		expect(platformConnections.tenantId).toBeDefined()
		expect(platformConnections.platform).toBeDefined()
		expect(platformConnections.accessToken).toBeDefined()
	})

	it('publishedContent should have required columns', () => {
		expect(publishedContent.id).toBeDefined()
		expect(publishedContent.tenantId).toBeDefined()
		expect(publishedContent.platform).toBeDefined()
		expect(publishedContent.platformContentId).toBeDefined()
		expect(publishedContent.status).toBeDefined()
	})

	it('engagementEvents should have required columns', () => {
		expect(engagementEvents.id).toBeDefined()
		expect(engagementEvents.publishedContentId).toBeDefined()
		expect(engagementEvents.eventType).toBeDefined()
		expect(engagementEvents.count).toBeDefined()
	})
})
