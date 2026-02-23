import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { verifySignature } from '../services/scraper/dispatcher'
import { processBatch } from '../services/scraper/batch-handler'
import { batchPayload } from '../types/api'
import { getConfig } from '../config'
import { logger } from '../utils/logger'

export function createIngestRoutes() {
	const router = new Hono<AppEnv>()

	router.post('/batch', async (c) => {
		const config = getConfig()
		const secret = config.SCRAPER_SHARED_SECRET
		const signature = c.req.header('x-signature')
		const timestamp = c.req.header('x-timestamp')
		const body = await c.req.text()

		if (!signature || !timestamp) {
			return c.json({ error: 'Missing HMAC headers' }, 401)
		}

		const ts = Number(timestamp)
		if (!Number.isFinite(ts)) {
			return c.json({ error: 'Invalid timestamp' }, 401)
		}

		const now = Math.floor(Date.now() / 1000)
		if (Math.abs(now - ts) > 300) {
			return c.json({ error: 'Timestamp too old' }, 401)
		}

		if (!verifySignature(body, timestamp, signature, secret)) {
			return c.json({ error: 'Invalid signature' }, 401)
		}

		let parsed: unknown
		try {
			parsed = JSON.parse(body)
		} catch {
			return c.json({ error: 'Invalid JSON body' }, 400)
		}

		const validation = batchPayload.safeParse(parsed)
		if (!validation.success) {
			logger.warn({ errors: validation.error.flatten() }, 'Invalid batch payload')
			return c.json({ error: 'Invalid batch payload', details: validation.error.flatten() }, 422)
		}

		const payload = validation.data
		const tenantId = payload.tenant_id
		if (!tenantId) {
			return c.json({ error: 'Missing tenant_id in payload' }, 400)
		}

		const result = await processBatch(payload, tenantId)
		return c.json(result)
	})

	return router
}
