export const SUPPORTED_CHANNELS = [
	'email', 'sms', 'voice', 'whatsapp', 'linkedin',
	'facebook', 'instagram', 'tiktok', 'youtube', 'vimeo', 'video',
] as const

export type SupportedChannel = (typeof SUPPORTED_CHANNELS)[number]
