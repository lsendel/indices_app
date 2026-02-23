import { describe, it, expect } from 'vitest'
import { campaignCreate, contentSyncRequest } from '../../src/types/api'

describe('expanded channel enums', () => {
	it('should accept all 11 channels in campaignCreate', () => {
		const channels = [
			'email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook',
			'instagram', 'tiktok', 'youtube', 'vimeo', 'video',
		]
		for (const channel of channels) {
			const result = campaignCreate.safeParse({
				name: 'Test',
				goal: 'Test',
				channels: [channel],
			})
			expect(result.success, `Channel ${channel} should be valid`).toBe(true)
		}
	})

	it('should accept new channels in contentSyncRequest', () => {
		const result = contentSyncRequest.safeParse({
			name: 'Test',
			channel: 'tiktok',
		})
		expect(result.success).toBe(true)
	})
})
