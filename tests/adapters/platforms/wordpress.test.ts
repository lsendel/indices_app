import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWordPressAdapter } from '../../../src/adapters/platforms/wordpress'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1',
	tenantId: 'tenant-1',
	platform: 'wordpress',
	accessToken: 'app-password',
	metadata: { siteUrl: 'https://myblog.com', username: 'admin' },
}

describe('WordPressAdapter', () => {
	const adapter = createWordPressAdapter()

	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should have correct name and platform', () => {
		expect(adapter.name).toBe('wordpress')
		expect(adapter.platform).toBe('wordpress')
	})

	it('should publish a post', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 42, link: 'https://myblog.com/hello-world' }),
		})

		const result = await adapter.publish(
			{ title: 'Hello World', content: '<p>My first post</p>', status: 'publish' },
			mockConnection,
		)
		expect(result.platformContentId).toBe('42')
		expect(result.url).toBe('https://myblog.com/hello-world')
		expect(result.status).toBe('published')
	})

	it('should publish a draft', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 43, link: 'https://myblog.com/?p=43' }),
		})

		const result = await adapter.publish(
			{ title: 'Draft Post', content: '<p>WIP</p>', status: 'draft' },
			mockConnection,
		)
		expect(result.platformContentId).toBe('43')
		expect(result.status).toBe('draft')
	})

	it('should use Basic Auth with username:appPassword', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: 44, link: 'https://myblog.com/test' }),
		})

		await adapter.publish({ title: 'Test', content: 'test' }, mockConnection)

		const callArgs = mockFetch.mock.calls[0]
		const headers = callArgs[1]?.headers as Record<string, string>
		const expectedAuth = btoa('admin:app-password')
		expect(headers.Authorization).toBe(`Basic ${expectedAuth}`)
	})

	it('should get engagement via comment count', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			headers: new Headers({ 'x-wp-total': '7' }),
			json: async () => [],
		})

		const metrics = await adapter.getEngagement('42', mockConnection)
		expect(metrics.comments).toBe(7)
	})
})
