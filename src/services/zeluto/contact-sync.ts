import type { ZelutoClient } from './client'
import type { ZelutoContactCreate, ZelutoContactImportResult } from '../../types/zeluto'

export interface ProspectData {
	name: string
	email?: string
	phone?: string
	company: string
	role: string
	linkedinId?: string
}

export function mapProspectToZelutoContact(prospect: ProspectData): ZelutoContactCreate {
	const nameParts = prospect.name.split(' ')
	const firstName = nameParts[0]
	const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

	return {
		email: prospect.email,
		firstName,
		lastName,
		phone: prospect.phone,
		customFields: {
			company: prospect.company,
			role: prospect.role,
			...(prospect.linkedinId ? { linkedinId: prospect.linkedinId } : {}),
		},
	}
}

const BATCH_SIZE = 100

export async function syncContacts(
	client: ZelutoClient,
	prospects: ProspectData[],
): Promise<ZelutoContactImportResult> {
	let totalImported = 0
	let totalFailed = 0
	const allErrors: Array<{ index: number; error: string }> = []

	const contacts = prospects.map(mapProspectToZelutoContact)

	for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
		const batch = contacts.slice(i, i + BATCH_SIZE)
		const result = await client.importContacts(batch)

		totalImported += result.imported
		totalFailed += result.failed
		for (const err of result.errors) {
			allErrors.push({ index: i + err.index, error: err.error })
		}
	}

	return { imported: totalImported, failed: totalFailed, errors: allErrors }
}
