import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { verifySignature } from '../services/scraper/dispatcher'
import { processBatch, type BatchPayload } from '../services/scraper/batch-handler'

export function createIngestRoutes() {
	const router = new Hono<AppEnv>()

	router.post('/batch', async (c) => {
		const secret = process.env.SCRAPER_SHARED_SECRET || 'dev-secret'
		const signature = c.req.header('x-signature')
		const timestamp = c.req.header('x-timestamp')
		const body = await c.req.text()

		if (!signature || !timestamp) {
			return c.json({ error: 'Missing HMAC headers' }, 401)
		}

		const now = Math.floor(Date.now() / 1000)
		if (Math.abs(now - parseInt(timestamp)) > 300) {
			return c.json({ error: 'Timestamp too old' }, 401)
		}

		if (!verifySignature(body, timestamp, signature, secret)) {
			return c.json({ error: 'Invalid signature' }, 401)
		}

		const payload = JSON.parse(body) as BatchPayload & { tenant_id?: string }
		const tenantId = payload.tenant_id ?? c.get('tenantId') ?? ''

		const result = await processBatch(payload, tenantId)

		return c.json(result)
	})

	return router
}
