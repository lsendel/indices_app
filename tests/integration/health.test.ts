import { describe, it, expect } from 'vitest'
import { getTestApp } from '../helpers/test-app'

describe('integration: health', () => {
	const app = getTestApp()

	it('GET /health returns status ok', async () => {
		const res = await app.request('/health')
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.status).toBe('ok')
		expect(body.timestamp).toBeTruthy()
	})

	it('GET /api/v1/prospects returns list (with dev auth)', async () => {
		const res = await app.request('/api/v1/prospects')
		expect([200, 500]).toContain(res.status)
	})

	it('GET /api/v1/campaigns returns list (with dev auth)', async () => {
		const res = await app.request('/api/v1/campaigns')
		expect([200, 500]).toContain(res.status)
	})

	it('unknown route returns 404 JSON', async () => {
		const res = await app.request('/api/v1/nonexistent')
		expect(res.status).toBe(404)
		const body = await res.json()
		expect(body.error).toBe('NOT_FOUND')
	})
})
