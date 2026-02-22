import { Hono } from 'hono'
import { createHmac, timingSafeEqual } from 'crypto'
import type { AppEnv } from '../app'
import { getConfig } from '../config'
import { zelutoWebhookEvent } from '../types/zeluto'

export function createZelutoWebhookRoutes() {
	const router = new Hono<AppEnv>()

	router.post('/', async (c) => {
		const config = getConfig()
		const secret = config.ZELUTO_WEBHOOK_SECRET

		// Verify HMAC signature
		const signatureHeader = c.req.header('X-Webhook-Signature')
		if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
			return c.json({ error: 'UNAUTHORIZED', message: 'Missing webhook signature' }, 401)
		}

		const providedSignature = signatureHeader.slice(7)
		const rawBody = await c.req.text()

		const expectedSignature = createHmac('sha256', secret).update(rawBody).digest('hex')

		try {
			const isValid = timingSafeEqual(
				Buffer.from(providedSignature),
				Buffer.from(expectedSignature),
			)
			if (!isValid) {
				return c.json({ error: 'UNAUTHORIZED', message: 'Invalid webhook signature' }, 401)
			}
		} catch {
			return c.json({ error: 'UNAUTHORIZED', message: 'Invalid webhook signature' }, 401)
		}

		// Parse and validate event
		const parsed = zelutoWebhookEvent.safeParse(JSON.parse(rawBody))
		if (!parsed.success) {
			return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid event payload' }, 422)
		}

		// Acknowledge receipt — event processing is best-effort
		// In production, this would store to delivery_events table and trigger async processing
		return c.json({ received: true })
	})

	return router
}
