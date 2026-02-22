import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('prospects routes', () => {
	const app = createApp()

	it('POST /api/v1/prospects validates required fields', async () => {
		const res = await app.request('/api/v1/prospects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(422)
	})

	it('POST /api/v1/prospects validates email format', async () => {
		const res = await app.request('/api/v1/prospects', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: 'Test User',
				company: 'Test Corp',
				role: 'CTO',
				email: 'not-an-email',
			}),
		})
		expect(res.status).toBe(422)
	})
})
