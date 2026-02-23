import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

export function createBlogAdapter(): PlatformAdapter {
	return {
		name: 'blog',
		platform: 'blog',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const webhookUrl = connection.metadata.webhookUrl as string
			const customHeaders = (connection.metadata.headers as Record<string, string>) || {}

			const res = await fetch(webhookUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Api-Key': connection.accessToken,
					...customHeaders,
				},
				body: JSON.stringify(content),
			})
			const data = (await res.json()) as { id?: string; url?: string }

			return {
				platformContentId: data.id ?? '',
				url: data.url ?? '',
				status: 'published',
			}
		},

		async getEngagement(_platformContentId: string, _connection: PlatformConnection): Promise<EngagementMetrics> {
			// Generic blog webhooks don't support engagement polling
			return { views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0 }
		},
	}
}
