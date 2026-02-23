import { describe, it, expect, vi } from 'vitest'
import { syncContent, mapChannelToTemplateType } from '../../../src/services/zeluto/content-sync'

describe('content sync', () => {
	describe('mapChannelToTemplateType', () => {
		it('maps email to email', () => {
			expect(mapChannelToTemplateType('email')).toBe('email')
		})

		it('maps sms to sms', () => {
			expect(mapChannelToTemplateType('sms')).toBe('sms')
		})

		it('defaults voice/linkedin to email', () => {
			expect(mapChannelToTemplateType('voice')).toBe('email')
			expect(mapChannelToTemplateType('linkedin')).toBe('email')
		})
	})

	describe('syncContent', () => {
		it('creates template via client and returns zeluto ID', async () => {
			const mockClient = {
				createTemplate: vi.fn().mockResolvedValue({
					id: 42,
					name: 'Welcome',
					type: 'email',
					subject: 'Hi',
				}),
			}

			const result = await syncContent(mockClient as any, {
				name: 'Welcome Email',
				channel: 'email',
				subject: 'Hi there',
				bodyHtml: '<h1>Welcome</h1>',
			})

			expect(result.zelutoTemplateId).toBe(42)
			expect(mockClient.createTemplate).toHaveBeenCalledWith({
				name: 'Welcome Email',
				type: 'email',
				subject: 'Hi there',
				bodyHtml: '<h1>Welcome</h1>',
				bodyText: undefined,
			})
		})

		it('passes bodyText when provided', async () => {
			const mockClient = {
				createTemplate: vi.fn().mockResolvedValue({ id: 10 }),
			}

			await syncContent(mockClient as any, {
				name: 'SMS Template',
				channel: 'sms',
				bodyText: 'Hello {{name}}',
			})

			expect(mockClient.createTemplate).toHaveBeenCalledWith(
				expect.objectContaining({ type: 'sms', bodyText: 'Hello {{name}}' }),
			)
		})
	})
})
