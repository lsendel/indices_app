import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTikTokAdapter } from '../../../src/adapters/platforms/tiktok'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1',
	tenantId: 'tenant-1',
	platform: 'tiktok',
	accessToken: 'tt-token',
	metadata: {},
}

describe('TikTokAdapter', () => {
	const adapter = createTikTokAdapter()

	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should have correct name and platform', () => {
		expect(adapter.name).toBe('tiktok')
		expect(adapter.platform).toBe('tiktok')
	})

	it('should publish a video via PULL_FROM_URL', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				data: { publish_id: 'pub-789' },
			}),
		})

		const result = await adapter.publish(
			{ videoUrl: 'https://example.com/video.mp4', title: 'Test video', privacy: 'PUBLIC_TO_EVERYONE' },
			mockConnection,
		)
		expect(result.platformContentId).toBe('pub-789')
		expect(result.status).toBe('processing')
	})

	it('should get engagement metrics', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				data: {
					videos: [
						{
							like_count: 100,
							comment_count: 25,
							share_count: 10,
							view_count: 5000,
						},
					],
				},
			}),
		})

		const metrics = await adapter.getEngagement('video-id-123', mockConnection)
		expect(metrics.views).toBe(5000)
		expect(metrics.likes).toBe(100)
		expect(metrics.comments).toBe(25)
		expect(metrics.shares).toBe(10)
	})
})
