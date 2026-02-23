import { describe, it, expect } from 'vitest'
import { getDefaultGroups, resolveGroupMembers, refreshBehavioralGroups } from '../../../src/services/loop/channel-groups'

describe('Channel Groups', () => {
	it('should return 7 default groups', () => {
		const groups = getDefaultGroups()
		expect(groups).toHaveLength(7)
		expect(groups.find((g) => g.name === 'all-channels')?.channels).toHaveLength(11)
		expect(groups.find((g) => g.name === 'social')?.type).toBe('static')
		expect(groups.find((g) => g.name === 'high-performers')?.type).toBe('behavioral')
	})

	it('should resolve static group members directly', () => {
		const members = resolveGroupMembers({
			name: 'social', type: 'static',
			channels: ['linkedin', 'facebook', 'instagram', 'tiktok'],
			criteria: null,
		})
		expect(members).toEqual(['linkedin', 'facebook', 'instagram', 'tiktok'])
	})

	it('should refresh behavioral groups from engagement data', () => {
		const channelScores = {
			email: 85, linkedin: 72, sms: 45, tiktok: 30,
			facebook: 60, instagram: 55, whatsapp: 40,
			voice: 35, youtube: 50, vimeo: 25, video: 20,
		}
		const groups = refreshBehavioralGroups(channelScores)
		expect(groups['high-performers']).toContain('email')
		expect(groups['high-performers']).toContain('linkedin')
		expect(groups['underperformers']).toContain('vimeo')
		expect(groups['underperformers']).toContain('video')
	})
})
