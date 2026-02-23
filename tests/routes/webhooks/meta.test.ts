import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createMetaWebhookRoutes } from '../../../src/routes/webhooks/meta'

vi.mock('../../../src/config', () => ({
	getConfig: vi.fn().mockReturnValue({
		META_APP_SECRET: 'test-secret',
	}),
}))

vi.mock('../../../src/db/client', () => {
	return {
		getDb: vi.fn().mockReturnValue({
			insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'evt-1' }]) }) }),
		}),
	}
})

describe('Meta webhook routes', () => {
	let app: Hono

	beforeEach(() => {
		app = new Hono()
		app.route('/webhooks/meta', createMetaWebhookRoutes())
	})

	it('GET / should respond to verification challenge', async () => {
		const res = await app.request(
			'/webhooks/meta?hub.mode=subscribe&hub.verify_token=test-secret&hub.challenge=challenge123',
		)
		expect(res.status).toBe(200)
		const text = await res.text()
		expect(text).toBe('challenge123')
	})

	it('GET / should reject invalid verify token', async () => {
		const res = await app.request(
			'/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=challenge123',
		)
		expect(res.status).toBe(403)
	})

	it('POST / should process Instagram engagement event', async () => {
		const res = await app.request('/webhooks/meta', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				object: 'instagram',
				entry: [
					{
						id: '17841405793001',
						time: 1700000000,
						changes: [
							{
								field: 'comments',
								value: { media_id: 'media-123', id: 'comment-456', text: 'Great post!' },
							},
						],
					},
				],
			}),
		})
		expect(res.status).toBe(200)
	})

	it('POST / should process WhatsApp delivery status', async () => {
		const res = await app.request('/webhooks/meta', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				object: 'whatsapp_business_account',
				entry: [
					{
						id: 'waba-123',
						changes: [
							{
								field: 'messages',
								value: {
									messaging_product: 'whatsapp',
									statuses: [
										{ id: 'wamid.abc', status: 'delivered', timestamp: '1700000000' },
									],
								},
							},
						],
					},
				],
			}),
		})
		expect(res.status).toBe(200)
	})
})
