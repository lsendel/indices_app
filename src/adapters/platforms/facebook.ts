import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export function createFacebookAdapter(): PlatformAdapter {
	return {
		name: 'facebook',
		platform: 'facebook',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const pageId = connection.metadata.pageId as string
			const message = [content.text, ...(content.hashtags || [])].join(' ')

			const res = await fetch(`${GRAPH_API}/${pageId}/feed`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message,
					link: content.link,
					access_token: connection.accessToken,
				}),
			})
			const { id } = (await res.json()) as { id: string }

			return { platformContentId: id, url: `https://facebook.com/${id}`, status: 'published' }
		},

		async getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics> {
			const res = await fetch(
				`${GRAPH_API}/${platformContentId}?fields=reactions.summary(true),comments.summary(true),shares&access_token=${connection.accessToken}`,
			)
			const data = (await res.json()) as any
			return {
				views: 0,
				likes: data.reactions?.summary?.total_count ?? 0,
				shares: data.shares?.count ?? 0,
				comments: data.comments?.summary?.total_count ?? 0,
				clicks: 0,
				saves: 0,
				conversions: 0,
			}
		},
	}
}
