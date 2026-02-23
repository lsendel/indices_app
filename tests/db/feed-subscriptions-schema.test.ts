import { describe, it, expect } from 'vitest'
import { feedSubscriptions } from '../../src/db/schema/feed-subscriptions'

describe('feed subscriptions schema', () => {
	it('has required columns', () => {
		expect(feedSubscriptions.id).toBeDefined()
		expect(feedSubscriptions.tenantId).toBeDefined()
		expect(feedSubscriptions.name).toBeDefined()
		expect(feedSubscriptions.feedUrl).toBeDefined()
		expect(feedSubscriptions.feedType).toBeDefined()
		expect(feedSubscriptions.schedule).toBeDefined()
		expect(feedSubscriptions.active).toBeDefined()
		expect(feedSubscriptions.lastFetchedAt).toBeDefined()
		expect(feedSubscriptions.lastContentHash).toBeDefined()
	})
})
