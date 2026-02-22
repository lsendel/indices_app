import { describe, it, expect } from 'vitest'
import { signPayload, verifySignature } from '../../src/services/scraper/dispatcher'

describe('HMAC signing', () => {
	const secret = 'test-secret'

	it('signs and verifies a payload', () => {
		const payload = JSON.stringify({ job_id: '123', pages: [] })
		const timestamp = Math.floor(Date.now() / 1000).toString()
		const signature = signPayload(payload, timestamp, secret)

		expect(verifySignature(payload, timestamp, signature, secret)).toBe(true)
	})

	it('rejects tampered payload', () => {
		const payload = JSON.stringify({ job_id: '123' })
		const timestamp = Math.floor(Date.now() / 1000).toString()
		const signature = signPayload(payload, timestamp, secret)

		expect(verifySignature('tampered', timestamp, signature, secret)).toBe(false)
	})
})
