import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { brandKits } from '../../db/schema'

export async function handleAuditBrandContent(content: string, brandKitId: string, tenantId: string) {
	const db = getDb()
	const [kit] = await db.select().from(brandKits).where(eq(brandKits.id, brandKitId))

	if (!kit) return { brandKitId, status: 'error', message: 'Brand kit not found' }

	const voiceAttributes = (kit.voiceAttributes ?? {}) as Record<string, unknown>
	return {
		brandKitId,
		brandName: kit.brandName,
		contentLength: content.length,
		voiceAttributes,
		status: 'audit_complete',
	}
}
