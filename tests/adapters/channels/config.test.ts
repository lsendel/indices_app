import { describe, it, expect } from 'vitest'
import { channelConfig, SUPPORTED_CHANNELS, type ContentBrief } from '../../../src/adapters/channels/config'

describe('channelConfig', () => {
	it('should define all 11 channels', () => {
		expect(SUPPORTED_CHANNELS).toHaveLength(11)
		expect(SUPPORTED_CHANNELS).toContain('email')
		expect(SUPPORTED_CHANNELS).toContain('sms')
		expect(SUPPORTED_CHANNELS).toContain('voice')
		expect(SUPPORTED_CHANNELS).toContain('whatsapp')
		expect(SUPPORTED_CHANNELS).toContain('linkedin')
		expect(SUPPORTED_CHANNELS).toContain('facebook')
		expect(SUPPORTED_CHANNELS).toContain('instagram')
		expect(SUPPORTED_CHANNELS).toContain('tiktok')
		expect(SUPPORTED_CHANNELS).toContain('youtube')
		expect(SUPPORTED_CHANNELS).toContain('vimeo')
		expect(SUPPORTED_CHANNELS).toContain('video')
	})

	it('should have constraints for every channel', () => {
		for (const channel of SUPPORTED_CHANNELS) {
			const config = channelConfig[channel]
			expect(config).toBeDefined()
			expect(config.format).toBeDefined()
			expect(config.promptSuffix).toBeDefined()
		}
	})

	it('should enforce email subject limit of 60', () => {
		expect(channelConfig.email.constraints.subjectLimit).toBe(60)
	})

	it('should enforce SMS character limit', () => {
		expect(channelConfig.sms.constraints.charLimit).toBe(160)
	})

	it('should enforce TikTok duration limit', () => {
		expect(channelConfig.tiktok.constraints.maxDuration).toBe(60)
	})
})
