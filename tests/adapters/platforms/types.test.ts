import { describe, it, expect } from 'vitest'
import type { PlatformAdapter, PublishResult, EngagementMetrics, PlatformConnection } from '../../../src/adapters/platforms/types'

describe('PlatformAdapter types', () => {
	it('should type-check a valid adapter implementation', () => {
		const adapter: PlatformAdapter = {
			name: 'test',
			platform: 'instagram',
			async publish(content, connection) {
				return { platformContentId: '123', url: 'https://example.com', status: 'published' }
			},
			async getEngagement(platformContentId, connection) {
				return { views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0 }
			},
		}
		expect(adapter.name).toBe('test')
		expect(adapter.platform).toBe('instagram')
	})

	it('should type-check PlatformConnection', () => {
		const conn: PlatformConnection = {
			id: 'uuid',
			tenantId: 'uuid',
			platform: 'instagram',
			accessToken: 'token',
			refreshToken: 'refresh',
			expiresAt: new Date(),
			scopes: 'instagram_basic,instagram_content_publish',
			metadata: {},
		}
		expect(conn.platform).toBe('instagram')
	})

	it('should type-check PublishResult', () => {
		const result: PublishResult = {
			platformContentId: '12345',
			url: 'https://instagram.com/p/abc',
			status: 'published',
		}
		expect(result.status).toBe('published')
	})
})
