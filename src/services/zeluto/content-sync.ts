import type { ZelutoClient } from './client'
import type { ZelutoTemplateCreate } from '../../types/zeluto'

export interface ContentSyncInput {
	name: string
	channel: string
	subject?: string
	bodyHtml?: string
	bodyText?: string
}

export interface ContentSyncResult {
	zelutoTemplateId: number
}

export function mapChannelToTemplateType(
	channel: string,
): ZelutoTemplateCreate['type'] {
	switch (channel) {
		case 'email':
			return 'email'
		case 'sms':
			return 'sms'
		default:
			return 'email'
	}
}

export async function syncContent(
	client: ZelutoClient,
	input: ContentSyncInput,
): Promise<ContentSyncResult> {
	const template = await client.createTemplate({
		name: input.name,
		type: mapChannelToTemplateType(input.channel),
		subject: input.subject,
		bodyHtml: input.bodyHtml,
		bodyText: input.bodyText,
	})

	return { zelutoTemplateId: template.id }
}
