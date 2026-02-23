export interface ContentBrief {
	goal: string
	product: string
	audience: string
	tone: string
	keywords?: string[]
	campaignId?: string
	brandKitId?: string
}

export interface EmailContent {
	subject: string
	preheader: string
	bodyHtml: string
	bodyText: string
	cta: { text: string; url: string }
}

export interface SMSContent {
	message: string
	parts: number
}

export interface VoiceContent {
	script: string
	duration: number
	tone: string
}

export interface WhatsAppContent {
	message: string
	templateName?: string
	buttons?: Array<{ text: string; url: string }>
}

export interface SocialContent {
	text: string
	hashtags: string[]
	mediaPrompt?: string
	cta?: string
}

export interface VideoScriptContent {
	script: string
	duration: number
	shots: Array<{ type: string; seconds: string; visual: string; audio: string }>
	captions: string
	hashtags: string[]
	thumbnailConcept: string
}

export interface YouTubeContent extends VideoScriptContent {
	title: string
	description: string
	tags: string[]
	chapters: Array<{ timestamp: string; title: string }>
}

export interface VimeoContent extends VideoScriptContent {
	title: string
	description: string
	tags: string[]
}

export type ChannelOutput =
	| EmailContent
	| SMSContent
	| VoiceContent
	| WhatsAppContent
	| SocialContent
	| VideoScriptContent
	| YouTubeContent
	| VimeoContent
