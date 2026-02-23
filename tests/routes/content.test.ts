import { describe, it, expect } from 'vitest'
import { createApp } from '../../src/app'

describe('content routes', () => {
	const app = createApp()

	it('GET /api/v1/content/channels should list all supported channels', async () => {
		const res = await app.request('/api/v1/content/channels')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.channels).toHaveLength(11)
		expect(body.channels[0]).toHaveProperty('name')
		expect(body.channels[0]).toHaveProperty('format')
	})

	it('POST /api/v1/content/generate should validate required fields', async () => {
		const res = await app.request('/api/v1/content/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(422)
	})

	it('POST /api/v1/content/generate should reject unsupported channel', async () => {
		const res = await app.request('/api/v1/content/generate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				channel: 'carrier_pigeon',
				brief: { goal: 'test', product: 'test', audience: 'test', tone: 'test' },
			}),
		})
		expect(res.status).toBe(422)
	})

	it('POST /api/v1/content/generate/batch should validate required fields', async () => {
		const res = await app.request('/api/v1/content/generate/batch', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		expect(res.status).toBe(422)
	})

	it('GET /api/v1/content/providers should list available providers', async () => {
		const res = await app.request('/api/v1/content/providers')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.providers).toBeInstanceOf(Array)
	})
})
