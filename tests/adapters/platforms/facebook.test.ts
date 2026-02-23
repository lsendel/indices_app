import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createFacebookAdapter } from '../../../src/adapters/platforms/facebook'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1',
	tenantId: 'tenant-1',
	platform: 'facebook',
	accessToken: 'fb-token',
	metadata: { pageId: '1234567890' },
}

describe('FacebookAdapter', () => {
	const adapter = createFacebookAdapter()

	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should have correct name and platform', () => {
		expect(adapter.name).toBe('facebook')
		expect(adapter.platform).toBe('facebook')
	})

	it('should publish a page post', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: '1234567890_9876543210' }),
		})

		const result = await adapter.publish(
			{ text: 'Hello Facebook', hashtags: ['#test'] },
			mockConnection,
		)
		expect(result.platformContentId).toBe('1234567890_9876543210')
		expect(result.status).toBe('published')
	})

	it('should get engagement metrics', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				reactions: { summary: { total_count: 42 } },
				comments: { summary: { total_count: 8 } },
				shares: { count: 3 },
			}),
		})

		const metrics = await adapter.getEngagement('1234567890_9876543210', mockConnection)
		expect(metrics.likes).toBe(42)
		expect(metrics.comments).toBe(8)
		expect(metrics.shares).toBe(3)
	})
})
