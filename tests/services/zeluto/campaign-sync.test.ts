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

		it('sends campaign when action is send', async () => {
			const mockClient = {
				createCampaign: vi.fn().mockResolvedValue({ id: 10, status: 'draft' }),
				sendCampaign: vi.fn().mockResolvedValue({ id: 10, status: 'sending' }),
			}

			const result = await syncCampaign(mockClient as any, {
				name: 'Launch',
				goal: 'Go',
				channels: ['email'],
				action: 'send',
			})

			expect(mockClient.sendCampaign).toHaveBeenCalledWith(10)
			expect(result.zelutoCampaignId).toBe(10)
		})

		it('schedules campaign when action is schedule', async () => {
			const mockClient = {
				createCampaign: vi.fn().mockResolvedValue({ id: 10, status: 'draft' }),
				scheduleCampaign: vi.fn().mockResolvedValue({ id: 10, status: 'scheduled' }),
			}

			const scheduledAt = '2026-03-01T09:00:00Z'
			const result = await syncCampaign(mockClient as any, {
				name: 'Launch',
				goal: 'Go',
				channels: ['email'],
				action: 'schedule',
				scheduledAt,
			})

			expect(mockClient.scheduleCampaign).toHaveBeenCalledWith(10, scheduledAt)
			expect(result.zelutoCampaignId).toBe(10)
		})
	})
})
