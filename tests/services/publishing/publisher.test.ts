import { describe, it, expect, vi, beforeEach } from 'vitest'
import { publishContent } from '../../../src/services/publishing/publisher'
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

describe('publishContent', () => {
	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should publish to the correct platform adapter', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 'post-123' }),
		})

		const result = await publishContent({
			platform: 'facebook',
			channel: 'facebook',
			content: { text: 'Hello from publisher' },
			connection: mockConnection,
			tenantId: 'tenant-1',
		})

		expect(result.platformContentId).toBe('post-123')
		expect(result.status).toBe('published')
	})

	it('should work with instagram adapter', async () => {
		const igConnection: PlatformConnection = {
			...mockConnection,
			platform: 'instagram',
			metadata: { igUserId: '17841405793001' },
		}

		// Container creation
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 'container-1' }),
		})
		// Container publish
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 'media-1' }),
		})

		const result = await publishContent({
			platform: 'instagram',
			channel: 'instagram',
			content: { text: 'IG post', mediaUrl: 'https://example.com/img.jpg' },
			connection: igConnection,
			tenantId: 'tenant-1',
		})

		expect(result.platformContentId).toBe('media-1')
		expect(result.status).toBe('published')
	})

	it('should throw for unsupported platform', async () => {
		await expect(
			publishContent({
				platform: 'myspace' as any,
				channel: 'myspace',
				content: {},
				connection: { ...mockConnection, platform: 'blog' },
				tenantId: 'tenant-1',
			}),
		).rejects.toThrow('Unsupported platform')
	})
})
