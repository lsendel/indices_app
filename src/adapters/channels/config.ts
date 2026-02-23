export { type ContentBrief } from './types'

export interface ChannelConstraints {
	[key: string]: unknown
}

export interface ChannelConfig {
	format: string
	constraints: ChannelConstraints
	promptSuffix: string
}

export const SUPPORTED_CHANNELS = [
	'email', 'sms', 'voice', 'whatsapp', 'linkedin', 'facebook',
	'instagram', 'tiktok', 'youtube', 'vimeo', 'video',
] as const

export type Channel = (typeof SUPPORTED_CHANNELS)[number]

export const channelConfig: Record<Channel, ChannelConfig> = {
	email: {
		format: 'html',
		constraints: { subjectLimit: 60, preheaderLimit: 100, ctaRequired: true },
		promptSuffix: 'Generate an email with subject (max 60 chars), preheader (max 100 chars), HTML body, plain text body, and a CTA button.',
	},
	sms: {
		format: 'text',
		constraints: { charLimit: 160, multiPartLimit: 320 },
		promptSuffix: 'Generate an SMS message (max 160 characters for single part, 320 for multi-part). Be concise and include a clear CTA.',
	},
	voice: {
		format: 'script',
		constraints: { maxDuration: 90, toneRequired: true },
		promptSuffix: 'Generate a voice call script. Use conversational tone, include pauses, and target 30-90 seconds duration.',
	},
	whatsapp: {
		format: 'rich_text',
		constraints: { charLimit: 4096, templateBased: true },
		promptSuffix: 'Generate a WhatsApp Business message (max 4096 chars). Can include buttons and media prompts. Keep it conversational.',
	},
	linkedin: {
		format: 'text',
		constraints: { postLimit: 3000, mediaTypes: ['image', 'video', 'document'] },
		promptSuffix: 'Generate a LinkedIn post (max 3000 chars). Professional tone, can include hashtags. Suggest media if relevant.',
	},
	facebook: {
		format: 'text',
		constraints: { postLimit: 63206, hashtagLimit: 30 },
		promptSuffix: 'Generate a Facebook post. Engaging, shareable, with relevant hashtags. Suggest media type if relevant.',
	},
	instagram: {
		format: 'caption',
		constraints: { captionLimit: 2200, hashtagLimit: 30, visualFirst: true },
		promptSuffix: 'Generate an Instagram caption (max 2200 chars, max 30 hashtags). Visual-first — describe the ideal image/video to pair with it.',
	},
	tiktok: {
		format: 'video_script',
		constraints: { maxDuration: 60, hashtagLimit: 5, aspectRatio: '9:16' },
		promptSuffix: 'Generate a TikTok video script (max 60s). Structure: hook (0-3s), body (3-50s), CTA (50-60s). Include captions and up to 5 hashtags.',
	},
	youtube: {
		format: 'video_script',
		constraints: { titleLimit: 100, descriptionLimit: 5000, tagLimit: 500 },
		promptSuffix: 'Generate a YouTube video script with title (max 100 chars), description (max 5000 chars), tags, chapter markers, and thumbnail concept.',
	},
	vimeo: {
		format: 'video_script',
		constraints: { titleLimit: 128, tagLimit: 20 },
		promptSuffix: 'Generate a Vimeo video script with title (max 128 chars), description, and tags. Professional, polished tone.',
	},
	video: {
		format: 'video_script',
		constraints: { flexible: true },
		promptSuffix: 'Generate a video script with shot list (type, duration, visual, audio), captions, and thumbnail concept.',
	},
}
