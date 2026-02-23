import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWhatsAppAdapter } from '../../../src/adapters/platforms/whatsapp'
import type { PlatformConnection } from '../../../src/adapters/platforms/types'

const mockFetch = vi.fn()
global.fetch = mockFetch

const mockConnection: PlatformConnection = {
	id: 'conn-1',
	tenantId: 'tenant-1',
	platform: 'whatsapp',
	accessToken: 'wa-token',
	metadata: { phoneNumberId: '111222333' },
}

describe('WhatsAppAdapter', () => {
	const adapter = createWhatsAppAdapter()

	beforeEach(() => {
		mockFetch.mockReset()
	})

	it('should have correct name and platform', () => {
		expect(adapter.name).toBe('whatsapp')
		expect(adapter.platform).toBe('whatsapp')
	})

	it('should send a template message', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				messaging_product: 'whatsapp',
				messages: [{ id: 'wamid.abc123' }],
			}),
		})

		const result = await adapter.publish(
			{ message: 'Hello', templateName: 'greeting', recipientPhone: '14155551234' },
			mockConnection,
		)
		expect(result.platformContentId).toBe('wamid.abc123')
		expect(result.status).toBe('published')
	})

	it('should send a text message', async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				messaging_product: 'whatsapp',
				messages: [{ id: 'wamid.def456' }],
			}),
		})

		const result = await adapter.publish(
			{ message: 'Plain text hello', recipientPhone: '14155551234' },
			mockConnection,
		)
		expect(result.platformContentId).toBe('wamid.def456')
		expect(result.status).toBe('published')
	})

	it('should return empty engagement metrics (webhook-based)', async () => {
		const metrics = await adapter.getEngagement('wamid.abc123', mockConnection)
		expect(metrics.views).toBe(0)
		expect(metrics.likes).toBe(0)
	})
})
