import type { PlatformAdapter, PlatformConnection, PublishResult, EngagementMetrics } from './types'

const TIKTOK_API = 'https://open.tiktokapis.com/v2'

export function createTikTokAdapter(): PlatformAdapter {
	return {
		name: 'tiktok',
		platform: 'tiktok',

		async publish(content: any, connection: PlatformConnection): Promise<PublishResult> {
			const res = await fetch(`${TIKTOK_API}/post/publish/video/init/`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${connection.accessToken}`,
					'Content-Type': 'application/json; charset=UTF-8',
				},
				body: JSON.stringify({
					post_info: {
						title: content.title || '',
						privacy_level: content.privacy || 'SELF_ONLY',
					},
					source_info: {
						source: 'PULL_FROM_URL',
						video_url: content.videoUrl,
					},
				}),
			})
			const { data } = (await res.json()) as { data: { publish_id: string } }

			return {
				platformContentId: data.publish_id,
				url: '',
				status: 'processing',
			}
		},

		async getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics> {
			const res = await fetch(`${TIKTOK_API}/video/query/?fields=like_count,comment_count,share_count,view_count`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${connection.accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					filters: { video_ids: [platformContentId] },
				}),
			})
			const { data } = (await res.json()) as {
				data: { videos: Array<{ like_count: number; comment_count: number; share_count: number; view_count: number }> }
			}

			const video = data.videos[0]
			return {
				views: video?.view_count ?? 0,
				likes: video?.like_count ?? 0,
				shares: video?.share_count ?? 0,
				comments: video?.comment_count ?? 0,
				clicks: 0,
				saves: 0,
				conversions: 0,
			}
		},
	}
}
