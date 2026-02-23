import type { PlatformAdapter, Platform } from './types'
import { createInstagramAdapter } from './instagram'
import { createFacebookAdapter } from './facebook'
import { createWhatsAppAdapter } from './whatsapp'
import { createTikTokAdapter } from './tiktok'
import { createLinkedInAdapter } from './linkedin'
import { createWordPressAdapter } from './wordpress'
import { createBlogAdapter } from './blog'

export function getPlatformAdapter(platform: Platform): PlatformAdapter {
	const adapters: Record<Platform, () => PlatformAdapter> = {
		instagram: createInstagramAdapter,
		facebook: createFacebookAdapter,
		whatsapp: createWhatsAppAdapter,
		tiktok: createTikTokAdapter,
		linkedin: createLinkedInAdapter,
		wordpress: createWordPressAdapter,
		blog: createBlogAdapter,
	}

	const factory = adapters[platform]
	if (!factory) throw new Error(`Unsupported platform: ${platform}`)
	return factory()
}

export * from './types'
export * from './oauth'
