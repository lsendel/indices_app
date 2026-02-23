import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

export function createWordPressAdapter(): PlatformAdapter {
	return {
		name: 'wordpress',
		platform: 'wordpress',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const siteUrl = connection.metadata.siteUrl as string
			const username = connection.metadata.username as string
			const appPassword = connection.accessToken
			const auth = btoa(`${username}:${appPassword}`)

			const wpStatus = content.status === 'draft' ? 'draft' : 'publish'

			const res = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
				method: 'POST',
				headers: {
					Authorization: `Basic ${auth}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					title: content.title,
					content: content.content,
					status: wpStatus,
					categories: content.categories,
					tags: content.tags,
				}),
			})
			const data = (await res.json()) as { id: number; link: string }

			return {
				platformContentId: String(data.id),
				url: data.link,
				status: wpStatus === 'draft' ? 'draft' : 'published',
			}
		},

		async getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics> {
			const siteUrl = connection.metadata.siteUrl as string
			const username = connection.metadata.username as string
			const auth = btoa(`${username}:${connection.accessToken}`)

			const res = await fetch(`${siteUrl}/wp-json/wp/v2/comments?post=${platformContentId}`, {
				headers: { Authorization: `Basic ${auth}` },
			})
			const totalComments = Number(res.headers.get('x-wp-total')) || 0

			return {
				views: 0,
				likes: 0,
				shares: 0,
				comments: totalComments,
				clicks: 0,
				saves: 0,
				conversions: 0,
			}
		},
	}
}
