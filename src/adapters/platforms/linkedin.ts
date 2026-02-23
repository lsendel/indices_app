import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

const LINKEDIN_API = 'https://api.linkedin.com'

export function createLinkedInAdapter(): PlatformAdapter {
	return {
		name: 'linkedin',
		platform: 'linkedin',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const authorUrn = connection.metadata.personUrn as string

			const res = await fetch(`${LINKEDIN_API}/rest/posts`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${connection.accessToken}`,
					'Content-Type': 'application/json',
					'LinkedIn-Version': '202401',
					'X-Restli-Protocol-Version': '2.0.0',
				},
				body: JSON.stringify({
					author: authorUrn,
					commentary: content.text,
					visibility: content.visibility || 'PUBLIC',
					distribution: {
						feedDistribution: 'MAIN_FEED',
					},
					lifecycleState: 'PUBLISHED',
				}),
			})
			const data = (await res.json()) as { id: string }
			const shareId = res.headers.get('x-restli-id') || data.id

			return {
				platformContentId: shareId,
				url: `https://www.linkedin.com/feed/update/${shareId}`,
				status: 'published',
			}
		},

		async getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics> {
			const encodedUrn = encodeURIComponent(platformContentId)
			const headers = {
				Authorization: `Bearer ${connection.accessToken}`,
				'LinkedIn-Version': '202401',
			}

			const [likesRes, commentsRes] = await Promise.all([
				fetch(`${LINKEDIN_API}/v2/socialActions/${encodedUrn}/likes?count=0`, { headers }),
				fetch(`${LINKEDIN_API}/v2/socialActions/${encodedUrn}/comments?count=0`, { headers }),
			])

			const likesData = (await likesRes.json()) as { paging: { total: number } }
			const commentsData = (await commentsRes.json()) as { paging: { total: number } }

			return {
				views: 0,
				likes: likesData.paging?.total ?? 0,
				shares: 0,
				comments: commentsData.paging?.total ?? 0,
				clicks: 0,
				saves: 0,
				conversions: 0,
			}
		},
	}
}
