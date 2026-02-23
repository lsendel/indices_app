import { describe, it, expect, vi, beforeEach } from 'vitest'
import { pollEngagement } from '../../../src/services/engagement/poller'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const makeConnection = (platform: string): PlatformConnection => ({
	id: `conn-${platform}`,
	tenantId: 'tenant-1',
	platform: platform as any,
	accessToken: `${platform}-token`,
	metadata: { siteUrl: 'https://myblog.com', username: 'admin', personUrn: 'urn:li:person:abc' },
})

describe('pollEngagement', () => {
	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should poll engagement for multiple targets concurrently', async () => {
		// WordPress comments response
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'x-wp-total': '12' }),
			json: async () => [],
		})
		// LinkedIn likes
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ paging: { total: 30 } }),
		})
		// LinkedIn comments
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ paging: { total: 8 } }),
		})

		const results = await pollEngagement([
			{
				publishedContentId: 'pub-1',
				platformContentId: '42',
				platform: 'wordpress',
				connection: makeConnection('wordpress'),
			},
			{
				publishedContentId: 'pub-2',
				platformContentId: 'urn:li:share:123',
				platform: 'linkedin',
				connection: makeConnection('linkedin'),
			},
		])

		expect(results).toHaveLength(2)
		expect(results[0].metrics.comments).toBe(12)
		expect(results[1].metrics.likes).toBe(30)
		expect(results[1].metrics.comments).toBe(8)
	})

	it('should return empty array for no targets', async () => {
		const results = await pollEngagement([])
		expect(results).toHaveLength(0)
	})

	it('should include publishedContentId in results', async () => {
		// TikTok video query response
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				data: {
					videos: [{ like_count: 200, comment_count: 50, share_count: 30, view_count: 10000 }],
				},
			}),
		})

		const results = await pollEngagement([
			{
				publishedContentId: 'pub-3',
				platformContentId: 'video-xyz',
				platform: 'tiktok',
				connection: makeConnection('tiktok'),
			},
		])

		expect(results[0].publishedContentId).toBe('pub-3')
		expect(results[0].metrics.views).toBe(10000)
		expect(results[0].metrics.likes).toBe(200)
	})
})
