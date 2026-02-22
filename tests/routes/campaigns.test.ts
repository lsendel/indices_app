import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('campaigns routes', () => {
	const app = createApp()

	it('POST /api/v1/campaigns validates required fields', async () => {
		const res = await app.request('/api/v1/campaigns', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(422)
	})

	it('POST /api/v1/campaigns requires at least one channel', async () => {
		const res = await app.request('/api/v1/campaigns', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Test Campaign',
				goal: 'Discovery Call',
				channels: [],
			}),
		})
		expect(res.status).toBe(422)
	})
})
