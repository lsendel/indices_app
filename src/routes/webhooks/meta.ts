import { Hono } from 'hono'
import type { AppEnv } from '../../app'
import { engagementEvents } from '../../db/schema'

export function createMetaWebhookRoutes() {
	const router = new Hono<AppEnv>()

	// Webhook verification (called once by Meta during setup)
	router.get('/', (c) => {
		const mode = c.req.query('hub.mode')
		const token = c.req.query('hub.verify_token')
		const challenge = c.req.query('hub.challenge')

		if (mode === 'subscribe' && token === c.env.META_APP_SECRET) {
			return c.text(challenge || '', 200)
		}
		return c.json({ error: 'Forbidden' }, 403)
	})

	// Event processing
	router.post('/', async (c) => {
		const body = await c.req.json()
		const db = c.var.db

		for (const entry of body.entry || []) {
			for (const change of entry.changes || []) {
				const event = normalizeMetaEvent(body.object, change)
				if (event) {
					await db.insert(engagementEvents).values(event)
				}
			}
		}

		return c.text('EVENT_RECEIVED', 200)
	})

	return router
}

function normalizeMetaEvent(
	objectType: string,
	change: any,
): {
	tenantId: string
	publishedContentId: string
	platform: string
	eventType: string
	count: number
	metadata: Record<string, unknown>
} | null {
	const field = change.field
	const value = change.value

	if (objectType === 'instagram') {
		const platform = 'instagram'
		const mediaId = value?.media_id || ''
		if (field === 'comments') {
			return {
				tenantId: '00000000-0000-0000-0000-000000000000',
				publishedContentId: '00000000-0000-0000-0000-000000000000',
				platform,
				eventType: 'comment',
				count: 1,
				metadata: { mediaId, commentId: value?.id, text: value?.text },
			}
		}
		if (field === 'likes') {
			return {
				tenantId: '00000000-0000-0000-0000-000000000000',
				publishedContentId: '00000000-0000-0000-0000-000000000000',
				platform,
				eventType: 'like',
				count: 1,
				metadata: { mediaId },
			}
		}
	}

	if (objectType === 'page') {
		return {
			tenantId: '00000000-0000-0000-0000-000000000000',
			publishedContentId: '00000000-0000-0000-0000-000000000000',
			platform: 'facebook',
			eventType: field === 'feed' ? 'comment' : 'view',
			count: 1,
			metadata: value || {},
		}
	}

	if (objectType === 'whatsapp_business_account') {
		const statuses = value?.statuses || []
		for (const status of statuses) {
			return {
				tenantId: '00000000-0000-0000-0000-000000000000',
				publishedContentId: '00000000-0000-0000-0000-000000000000',
				platform: 'whatsapp',
				eventType: status.status === 'read' ? 'view' : 'click',
				count: 1,
				metadata: { messageId: status.id, status: status.status },
			}
		}
	}

	return null
}
