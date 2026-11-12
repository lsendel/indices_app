import { describe, it, expect, vi } from 'vitest'
import {
	syncCampaign,
	mapChannelToZelutoCampaignType,
} from '../../../src/services/zeluto/campaign-sync'

describe('campaign sync', () => {
	describe('mapChannelToZelutoCampaignType', () => {
		it('maps single email channel', () => {
			expect(mapChannelToZelutoCampaignType(['email'])).toBe('email')
		})

		it('maps single sms channel', () => {
			expect(mapChannelToZelutoCampaignType(['sms'])).toBe('sms')
		})

		it('maps multiple channels to multichannel', () => {
			expect(mapChannelToZelutoCampaignType(['email', 'sms'])).toBe('multichannel')
		})

		it('maps voice to multichannel', () => {
			expect(mapChannelToZelutoCampaignType(['voice'])).toBe('multichannel')
		})
	})

	describe('syncCampaign', () => {
		it('creates campaign via client', async () => {
			const mockClient = {
				createCampaign: vi.fn().mockResolvedValue({
					id: 10,
					name: 'Spring Launch',
					status: 'draft',
					type: 'email',
				}),
			}

			const result = await syncCampaign(mockClient as any, {
				name: 'Spring Launch',
				goal: 'Drive signups',
				channels: ['email'],
			})

			expect(result.zelutoCampaignId).toBe(10)
			expect(mockClient.createCampaign).toHaveBeenCalledWith({
				name: 'Spring Launch',
				description: 'Drive signups',
				type: 'email',
			})
		})

		it('refuses to send or schedule from Indices', async () => {
			const mockClient = {
				createCampaign: vi.fn(),
				sendCampaign: vi.fn(),
				scheduleCampaign: vi.fn(),
			}
			for (const action of ['send', 'schedule'] as const) {
				await expect(
					syncCampaign(mockClient as any, { name: 'Launch', goal: 'Go', channels: ['email'], action } as any),
				).rejects.toThrow(/send gate/)
			}
			expect(mockClient.createCampaign).not.toHaveBeenCalled()
			expect(mockClient.sendCampaign).not.toHaveBeenCalled()
			expect(mockClient.scheduleCampaign).not.toHaveBeenCalled()
		})
	})
})
