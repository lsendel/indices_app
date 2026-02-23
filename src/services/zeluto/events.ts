export type EventClassification = 'engagement' | 'negative' | 'neutral'

const ENGAGEMENT_EVENTS = new Set(['opened', 'clicked'])
const NEGATIVE_EVENTS = new Set(['bounced', 'complained', 'unsubscribed', 'failed'])

export function classifyDeliveryEvent(eventType: string): EventClassification {
	if (ENGAGEMENT_EVENTS.has(eventType)) return 'engagement'
	if (NEGATIVE_EVENTS.has(eventType)) return 'negative'
	return 'neutral'
}

export function isEngagementEvent(eventType: string): boolean {
	return ENGAGEMENT_EVENTS.has(eventType)
}
