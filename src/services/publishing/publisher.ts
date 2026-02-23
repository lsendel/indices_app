import { getPlatformAdapter } from '../../adapters/platforms'
import type { Platform, PlatformConnection, PublishResult } from '../../adapters/platforms/types'

export interface PublishInput {
	platform: string
	channel: string
	content: unknown
	connection: PlatformConnection
	campaignId?: string
	tenantId: string
}

export async function publishContent(input: PublishInput): Promise<PublishResult> {
	const adapter = getPlatformAdapter(input.platform as Platform)
	const result = await adapter.publish(input.content, input.connection)
	return result
}
