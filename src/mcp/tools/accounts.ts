import { eq, desc } from 'drizzle-orm'
import type { Database } from '../../db/client'
import { accounts } from '../../db/schema'

export async function handleGetHotAccounts(db: Database, threshold: number, limit: number, tenantId: string) {
	const rows = await db.select().from(accounts)
		.where(eq(accounts.tenantId, tenantId))
		.orderBy(desc(accounts.score))
		.limit(limit)

	return { accounts: rows, threshold }
}

export async function handleScoreLead(input: { email?: string; company?: string; signals: string[] }, tenantId: string) {
	const signalWeights: Record<string, number> = {
		demo_request: 30, pricing_view: 20, content_download: 10,
		page_view: 5, email_open: 5, email_click: 10,
		form_submit: 25, social_mention: 8,
	}

	const score = Math.min(100, input.signals.reduce((sum, s) => sum + (signalWeights[s] ?? 3), 0))
	return { score, signals: input.signals, company: input.company }
}
