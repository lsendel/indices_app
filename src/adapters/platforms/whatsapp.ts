import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export function createWhatsAppAdapter(): PlatformAdapter {
	return {
		name: 'whatsapp',
		platform: 'whatsapp',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const phoneNumberId = connection.metadata.phoneNumberId as string

			const body: Record<string, unknown> = {
				messaging_product: 'whatsapp',
				recipient_type: 'individual',
				to: content.recipientPhone,
			}

			if (content.templateName) {
				body.type = 'template'
				body.template = {
					name: content.templateName,
					language: { code: content.languageCode || 'en_US' },
					components: content.components || [],
				}
			} else {
				body.type = 'text'
				body.text = { body: content.message }
			}

			const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${connection.accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			})
			const data = (await res.json()) as { messages: Array<{ id: string }> }

			return {
				platformContentId: data.messages[0]?.id ?? '',
				url: '',
				status: 'published',
			}
		},

		async getEngagement(_platformContentId: string, _connection: PlatformConnection): Promise<EngagementMetrics> {
			// WhatsApp engagement is tracked via delivery status webhooks, not polling
			return { views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0 }
		},
	}
}
