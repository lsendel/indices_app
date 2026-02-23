import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createInstagramAdapter } from '../../../src/adapters/platforms/instagram'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1',
	tenantId: 'tenant-1',
	platform: 'instagram',
	accessToken: 'ig-token',
	metadata: { igUserId: '17841405793001' },
}

describe('InstagramAdapter', () => {
	const adapter = createInstagramAdapter()

	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should have correct name and platform', () => {
		expect(adapter.name).toBe('instagram')
		expect(adapter.platform).toBe('instagram')
	})

	it('should publish a photo via container flow', async () => {
		// Step 1: create container
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 'container-123' }),
		})
		// Step 2: publish container
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 'media-456' }),
		})

		const result = await adapter.publish(
			{ text: 'Hello Instagram', mediaUrl: 'https://example.com/photo.jpg', hashtags: ['#test'] },
			mockConnection,
		)

		expect(result.platformContentId).toBe('media-456')
		expect(result.status).toBe('published')
		expect(mockFetch).toHaveBeenCalledTimes(2)
	})

	it('should get engagement metrics', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				data: [
					{ name: 'impressions', values: [{ value: 1000 }] },
					{ name: 'likes', values: [{ value: 50 }] },
					{ name: 'comments', values: [{ value: 10 }] },
					{ name: 'shares', values: [{ value: 5 }] },
					{ name: 'saved', values: [{ value: 20 }] },
				],
			}),
		})

		const metrics = await adapter.getEngagement('media-456', mockConnection)
		expect(metrics.views).toBe(1000)
		expect(metrics.likes).toBe(50)
		expect(metrics.saves).toBe(20)
	})
})
