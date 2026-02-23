import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createBlogAdapter } from '../../../src/adapters/platforms/blog'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1',
	tenantId: 'tenant-1',
	platform: 'blog',
	accessToken: 'api-key-123',
	metadata: {
		webhookUrl: 'https://hooks.example.com/publish',
		headers: { 'X-Custom': 'value' },
	},
}

describe('BlogAdapter', () => {
	const adapter = createBlogAdapter()

	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should have correct name and platform', () => {
		expect(adapter.name).toBe('blog')
		expect(adapter.platform).toBe('blog')
	})

	it('should POST content to webhook URL', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 'ext-post-1', url: 'https://blog.example.com/post/1' }),
		})

		const result = await adapter.publish(
			{ title: 'Blog Post', body: 'Content here' },
			mockConnection,
		)
		expect(result.platformContentId).toBe('ext-post-1')
		expect(result.url).toBe('https://blog.example.com/post/1')
		expect(result.status).toBe('published')
	})

	it('should include custom headers and API key', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 'ext-post-2' }),
		})

		await adapter.publish({ title: 'Test' }, mockConnection)

		const callArgs = mockFetch.mock.calls[0]
		const headers = callArgs[1]?.headers as Record<string, string>
		expect(headers['X-Custom']).toBe('value')
		expect(headers['X-Api-Key']).toBe('api-key-123')
	})

	it('should return empty engagement metrics', async () => {
		const metrics = await adapter.getEngagement('ext-post-1', mockConnection)
		expect(metrics.views).toBe(0)
		expect(metrics.likes).toBe(0)
	})
})
