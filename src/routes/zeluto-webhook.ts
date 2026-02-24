import { Hono } from 'hono'
import { createHmac, timingSafeEqual } from 'crypto'
import { eq } from 'drizzle-orm'
import type { AppEnv } from '../app'
import { zelutoWebhookEvent } from '../types/zeluto'
import { deliveryEvents, zelutoConfigs } from '../db/schema'

const ZELUTO_EVENT_TYPE_MAP: Record<string, 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained' | 'unsubscribed' | 'failed'> = {
	'delivery.queued': 'queued',
	'delivery.sent': 'sent',
	'delivery.delivered': 'delivered',
	'delivery.opened': 'opened',
	'delivery.clicked': 'clicked',
	'delivery.bounced': 'bounced',
	'delivery.complained': 'complained',
	'delivery.unsubscribed': 'unsubscribed',
	'delivery.failed': 'failed',
}

export function createZelutoWebhookRoutes() {
	const router = new Hono<AppEnv>()

	router.post('/', async (c) => {
		const secret = c.env.ZELUTO_WEBHOOK_SECRET || 'dev-webhook-secret'

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

		const event = parsed.data
		const db = c.var.db
		const loopSystem = c.var.loopSystem

		// Best-effort: store event and emit to event bus
		try {
			if (db) {
				await processWebhookEvent(db, loopSystem, event)
			}
		} catch {
			// Webhook processing is best-effort — always acknowledge receipt
		}

		return c.json({ received: true })
	})

	return router
}

async function processWebhookEvent(
	db: import('../db/client').Database,
	loopSystem: import('../services/loop/bootstrap').LoopSystem | undefined,
	event: { eventType: string; payload: Record<string, unknown> },
) {
	// Resolve tenant from zeluto config (webhook is server-to-server, no user session)
	const [config] = await db
		.select({ tenantId: zelutoConfigs.tenantId })
		.from(zelutoConfigs)
		.where(eq(zelutoConfigs.active, true))
		.limit(1)

	if (!config) return

	const tenantId = config.tenantId
	const deliveryEventType = ZELUTO_EVENT_TYPE_MAP[event.eventType]
	if (!deliveryEventType) return

	const payload = event.payload
	const channel = (payload.channel as string) ?? 'email'

	await db.insert(deliveryEvents).values({
		tenantId,
		zelutoJobId: (payload.jobId as string) ?? null,
		channel: channel as any,
		eventType: deliveryEventType,
		contactEmail: (payload.contactEmail as string) ?? null,
		providerMessageId: (payload.providerMessageId as string) ?? null,
		eventData: payload,
		occurredAt: new Date(),
	})

	// Emit to event bus for pipeline processing
	if (loopSystem) {
		await loopSystem.watchers.delivery.onDeliveryCompleted(tenantId, {
			campaignId: (payload.campaignId as string) ?? '',
			channel,
			metrics: { [deliveryEventType]: 1 },
		})
	}
}
