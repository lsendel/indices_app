import { describe, it, expect, vi } from 'vitest'
import { getTestApp } from '../helpers/test-app'

describe('zeluto sync routes', () => {
	const app = getTestApp()

	describe('POST /api/v1/zeluto/config', () => {
		it('validates zeluto config input', async () => {
			const res = await app.request('/api/v1/zeluto/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})

		it('accepts valid config', async () => {
			const res = await app.request('/api/v1/zeluto/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					organizationId: 'org-123',
					userId: 'user-456',
					userRole: 'admin',
					plan: 'pro',
				}),
			})

			// Will fail with DB error in test env, but validation passes
			expect(res.status).not.toBe(422)
		})
	})

	describe('POST /api/v1/zeluto/sync/content', () => {
		it('validates content sync input', async () => {
			const res = await app.request('/api/v1/zeluto/sync/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})

		it('requires name and channel', async () => {
			const res = await app.request('/api/v1/zeluto/sync/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Test', channel: 'email' }),
			})

			// Passes validation (422 would mean validation failed)
			expect(res.status).not.toBe(422)
		})
	})

	describe('POST /api/v1/zeluto/sync/contacts', () => {
		it('validates contact sync input', async () => {
			const res = await app.request('/api/v1/zeluto/sync/contacts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})
	})

	describe('POST /api/v1/zeluto/sync/campaign', () => {
		it('validates campaign sync input', async () => {
			const res = await app.request('/api/v1/zeluto/sync/campaign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})
	})

	describe('POST /api/v1/zeluto/sync/experiment', () => {
		it('validates experiment sync input', async () => {
			const res = await app.request('/api/v1/zeluto/sync/experiment', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect(res.status).toBe(422)
		})
	})

	describe('GET /api/v1/zeluto/sync/logs', () => {
		it('accepts pagination params', async () => {
			const res = await app.request('/api/v1/zeluto/sync/logs?page=1&limit=10')

			// Will fail with DB error in test env, but route exists
			expect(res.status).not.toBe(404)
		})
	})
})
