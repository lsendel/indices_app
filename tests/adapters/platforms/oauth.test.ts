import { describe, it, expect } from 'vitest'
import { buildOAuthUrl, exchangeCodeForTokens } from '../../../src/adapters/platforms/oauth'

describe('OAuth helpers', () => {
	it('should build Meta OAuth URL with correct params', () => {
		const url = buildOAuthUrl('meta', {
			clientId: 'app123',
			redirectUri: 'https://pi.indices.app/api/v1/platforms/instagram/callback',
			scopes: ['instagram_basic', 'instagram_content_publish'],
			state: 'csrf-token',
		})
		expect(url).toContain('facebook.com')
		expect(url).toContain('client_id=app123')
		expect(url).toContain('instagram_basic')
		expect(url).toContain('state=csrf-token')
	})

	it('should build LinkedIn OAuth URL', () => {
		const url = buildOAuthUrl('linkedin', {
			clientId: 'linkedin-app',
			redirectUri: 'https://pi.indices.app/api/v1/platforms/linkedin/callback',
			scopes: ['w_member_social'],
			state: 'csrf-token',
		})
		expect(url).toContain('linkedin.com')
		expect(url).toContain('w_member_social')
	})

	it('should build TikTok OAuth URL', () => {
		const url = buildOAuthUrl('tiktok', {
			clientId: 'tiktok-key',
			redirectUri: 'https://pi.indices.app/api/v1/platforms/tiktok/callback',
			scopes: ['video.publish'],
			state: 'csrf-token',
		})
		expect(url).toContain('tiktok.com')
		expect(url).toContain('video.publish')
	})
})
