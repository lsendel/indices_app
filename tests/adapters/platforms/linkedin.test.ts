import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createLinkedInAdapter } from '../../../src/adapters/platforms/linkedin'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1',
	tenantId: 'tenant-1',
	platform: 'linkedin',
	accessToken: 'li-token',
	metadata: { personUrn: 'urn:li:person:abc123' },
}

describe('LinkedInAdapter', () => {
	const adapter = createLinkedInAdapter()

	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should have correct name and platform', () => {
		expect(adapter.name).toBe('linkedin')
		expect(adapter.platform).toBe('linkedin')
	})

	it('should publish a post', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'x-restli-id': 'urn:li:share:12345' }),
			json: async () => ({ id: 'urn:li:share:12345' }),
		})

		const result = await adapter.publish(
			{ text: 'Hello LinkedIn', visibility: 'PUBLIC' },
			mockConnection,
		)
		expect(result.platformContentId).toBe('urn:li:share:12345')
		expect(result.status).toBe('published')
	})

	it('should get engagement metrics', async () => {
		// Likes response
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				paging: { total: 15 },
			}),
		})
		// Comments response
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				paging: { total: 5 },
			}),
		})

		const metrics = await adapter.getEngagement('urn:li:share:12345', mockConnection)
		expect(metrics.likes).toBe(15)
		expect(metrics.comments).toBe(5)
	})
})
