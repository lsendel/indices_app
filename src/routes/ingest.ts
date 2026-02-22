import { Hono } from 'hono'
import type { AppEnv } from '../app'
import { verifySignature } from '../services/scraper/dispatcher'

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

		const batch = JSON.parse(body) as {
			job_id: string
			batch_index: number
			is_final: boolean
			pages?: unknown[]
			posts?: unknown[]
		}

		console.log('Received scraper batch', { jobId: batch.job_id, batchIndex: batch.batch_index, isFinal: batch.is_final })

		return c.json({ received: true, jobId: batch.job_id, batchIndex: batch.batch_index })
	})

	return router
}
