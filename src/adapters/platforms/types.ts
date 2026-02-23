export type Platform = 'instagram' | 'facebook' | 'whatsapp' | 'tiktok' | 'linkedin' | 'wordpress' | 'blog'

export interface PlatformConnection {
	id: string
	tenantId: string
	platform: Platform
	accessToken: string
	refreshToken?: string
	expiresAt?: Date
	scopes?: string
	metadata: Record<string, unknown>
}

export interface PublishResult {
	platformContentId: string
	url: string
	status: 'published' | 'draft' | 'scheduled' | 'processing'
}

export interface EngagementMetrics {
	views: number
	likes: number
	shares: number
	comments: number
	clicks: number
	saves: number
	conversions: number
}

export interface PlatformAdapter {
	name: string
	platform: Platform
	publish(content: unknown, connection: PlatformConnection): Promise<PublishResult>
	getEngagement(platformContentId: string, connection: PlatformConnection): Promise<EngagementMetrics>
	verifyWebhook?(payload: unknown, signature: string): boolean
}
