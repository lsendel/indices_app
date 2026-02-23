import { z } from 'zod'
import type { LLMRouter } from '../llm'
import { channelConfig, SUPPORTED_CHANNELS, type Channel, type ContentBrief } from './config'

const emailSchema = z.object({
	subject: z.string(),
	preheader: z.string(),
	bodyHtml: z.string(),
	bodyText: z.string(),
	cta: z.object({ text: z.string(), url: z.string() }),
})

const smsSchema = z.object({ message: z.string(), parts: z.number() })

const voiceSchema = z.object({ script: z.string(), duration: z.number(), tone: z.string() })

const whatsappSchema = z.object({
	message: z.string(),
	templateName: z.string().optional(),
	buttons: z.array(z.object({ text: z.string(), url: z.string() })).optional(),
})

const socialSchema = z.object({
	text: z.string(),
	hashtags: z.array(z.string()),
	mediaPrompt: z.string().optional(),
	cta: z.string().optional(),
})

const videoScriptSchema = z.object({
	script: z.string(),
	duration: z.number(),
	shots: z.array(z.object({ type: z.string(), seconds: z.string(), visual: z.string(), audio: z.string() })),
	captions: z.string(),
	hashtags: z.array(z.string()),
	thumbnailConcept: z.string(),
})

const youtubeSchema = videoScriptSchema.extend({
	title: z.string(),
	description: z.string(),
	tags: z.array(z.string()),
	chapters: z.array(z.object({ timestamp: z.string(), title: z.string() })),
})

const vimeoSchema = videoScriptSchema.extend({
	title: z.string(),
	description: z.string(),
	tags: z.array(z.string()),
})

const channelSchemas: Record<Channel, z.ZodType> = {
	email: emailSchema,
	sms: smsSchema,
	voice: voiceSchema,
	whatsapp: whatsappSchema,
	linkedin: socialSchema,
	facebook: socialSchema,
	instagram: socialSchema,
	tiktok: videoScriptSchema,
	youtube: youtubeSchema,
	vimeo: vimeoSchema,
	video: videoScriptSchema,
}

function buildPrompt(channel: Channel, brief: ContentBrief): string {
	const config = channelConfig[channel]
	return [
		`Generate ${channel} content for the following brief:`,
		`Goal: ${brief.goal}`,
		`Product: ${brief.product}`,
		`Target audience: ${brief.audience}`,
		`Tone: ${brief.tone}`,
		brief.keywords?.length ? `Keywords: ${brief.keywords.join(', ')}` : '',
		'',
		`Platform constraints: ${JSON.stringify(config.constraints)}`,
		'',
		config.promptSuffix,
	].filter(Boolean).join('\n')
}

export async function generateForChannel(
	channel: string,
	brief: ContentBrief,
	router: LLMRouter,
	providerOverride?: string,
): Promise<unknown> {
	if (!SUPPORTED_CHANNELS.includes(channel as Channel)) {
		throw new Error(`Unsupported channel: ${channel}`)
	}

	const ch = channel as Channel
	const provider = router.resolve(`content:${ch}`)
	const prompt = buildPrompt(ch, brief)
	const schema = channelSchemas[ch]

	return provider.generateJSON(prompt, schema, {
		systemPrompt: `You are a marketing content generator specializing in ${channel} content. Always respond with valid JSON matching the requested schema.`,
	})
}
