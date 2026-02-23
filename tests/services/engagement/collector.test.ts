import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectEngagement } from '../../../src/services/engagement/collector'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1',
	tenantId: 'tenant-1',
	platform: 'facebook',
	accessToken: 'fb-token',
	metadata: { pageId: '123' },
}

describe('collectEngagement', () => {
	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should collect engagement metrics for a published content item', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				reactions: { summary: { total_count: 42 } },
				comments: { summary: { total_count: 8 } },
				shares: { count: 3 },
			}),
		})

		const result = await collectEngagement({
			publishedContentId: 'pub-1',
			platformContentId: 'post-123',
			platform: 'facebook',
			connection: mockConnection,
		})

		expect(result.metrics.likes).toBe(42)
		expect(result.metrics.comments).toBe(8)
		expect(result.metrics.shares).toBe(3)
		expect(result.score).toBeGreaterThan(0)
	})
})
