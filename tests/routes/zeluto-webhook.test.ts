import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'crypto'
import { getTestApp } from '../helpers/test-app'

describe('POST /webhooks/zeluto', () => {
	const app = getTestApp()
	const secret = 'dev-webhook-secret'

	function sign(body: string): string {
		return createHmac('sha256', secret).update(body).digest('hex')
	}

	it('accepts valid webhook with HMAC signature', async () => {
		const body = JSON.stringify({
			eventType: 'delivery.opened',
			payload: {
				jobId: 'job-1',
				contactId: 42,
				channel: 'email',
				eventType: 'opened',
			},
		})
		const signature = sign(body)

		const res = await app.request('/webhooks/zeluto', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Webhook-Signature': `sha256=${signature}`,
			},
			body,
		})

		expect(res.status).toBe(200)
		const json = await res.json()
		expect(json.received).toBe(true)
	})

	it('rejects missing signature', async () => {
		const res = await app.request('/webhooks/zeluto', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ eventType: 'test', payload: {} }),
		})

		expect(res.status).toBe(401)
	})

	it('rejects invalid signature', async () => {
		const body = JSON.stringify({ eventType: 'test', payload: {} })

		const res = await app.request('/webhooks/zeluto', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Webhook-Signature': 'sha256=invalid',
			},
			body,
		})

		expect(res.status).toBe(401)
	})
})
