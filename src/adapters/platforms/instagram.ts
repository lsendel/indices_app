import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

const GRAPH_API = 'https://graph.facebook.com/v21.0'

export function createInstagramAdapter(): PlatformAdapter {
	return {
		name: 'instagram',
		platform: 'instagram',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const igUserId = connection.metadata.igUserId as string
			const token = connection.accessToken
			const caption = [content.text, ...(content.hashtags || [])].join(' ')

			// Step 1: Create media container
			const containerRes = await fetch(`${GRAPH_API}/${igUserId}/media`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					image_url: content.mediaUrl,
					caption,
					access_token: token,
				}),
			})
			const { id: creationId } = (await containerRes.json()) as { id: string }

			// Step 2: Publish container
			const publishRes = await fetch(`${GRAPH_API}/${igUserId}/media_publish`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ creation_id: creationId, access_token: token }),
			})
			const { id: mediaId } = (await publishRes.json()) as { id: string }

			return {
				platformContentId: mediaId,
				url: `https://www.instagram.com/p/${mediaId}`,
				status: 'published',
			}
		},

		async getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics> {
			const res = await fetch(
				`${GRAPH_API}/${platformContentId}/insights?metric=impressions,likes,comments,shares,saved&access_token=${connection.accessToken}`,
			)
			const { data } = (await res.json()) as {
				data: Array<{ name: string; values: Array<{ value: number }> }>
			}

			const metrics: EngagementMetrics = { views: 0, likes: 0, shares: 0, comments: 0, clicks: 0, saves: 0, conversions: 0 }
			for (const metric of data) {
				const value = metric.values[0]?.value ?? 0
				if (metric.name === 'impressions') metrics.views = value
				else if (metric.name === 'likes') metrics.likes = value
				else if (metric.name === 'comments') metrics.comments = value
				else if (metric.name === 'shares') metrics.shares = value
				else if (metric.name === 'saved') metrics.saves = value
			}
			return metrics
		},
	}
}
