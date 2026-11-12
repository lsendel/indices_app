import { z } from 'zod'

/**
 * Campaign creative: the email text lives in Indices, a human approves it, and
 * Zeluto only ingests approved creative. The sender address, reply-to and postal
 * footer are NOT part of the creative: they come from the Zeluto sender profile
 * selected by `brandKey`, so preview equals what is sent.
 */

export const PLACEHOLDER_PATTERNS = [/\[postal address pending\]/i, /\[address pending\]/i, /\bTODO\b/, /\{\{\s*[a-z_]+\s*\}\}\s*\{\{/]

export const audienceSpec = z.object({
	source: z.string().min(1).max(200),
	rules: z.record(z.string(), z.any()).default({}),
	exclusions: z.array(z.string().max(100)).default(['suppression', 'dnc', 'recently_emailed']),
	recipients: z.array(z.string().email()).max(5000).optional(),
})
export type AudienceSpec = z.infer<typeof audienceSpec>

export const creativeUpdate = z.object({
	brandKey: z.string().min(1).max(100).regex(/^[a-z0-9][a-z0-9._-]*$/i),
	subject: z.string().min(1).max(200),
	previewText: z.string().max(200).optional(),
	bodyHtml: z.string().min(1).max(100_000).optional(),
	bodyText: z.string().min(1).max(100_000),
	audienceSpec: audienceSpec.optional(),
})
export type CreativeUpdate = z.infer<typeof creativeUpdate>

export interface CreativeFields {
	brandKey: string | null
	subject: string | null
	previewText: string | null
	bodyHtml: string | null
	bodyText: string | null
	audienceSpec: unknown
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
	const obj = value as Record<string, unknown>
	return `{${Object.keys(obj).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** SHA-256 hex over every field a recipient or the audience depends on. */
export async function computeContentHash(c: CreativeFields): Promise<string> {
	const canonical = stableStringify({
		brandKey: c.brandKey,
		subject: c.subject,
		previewText: c.previewText,
		bodyHtml: c.bodyHtml,
		bodyText: c.bodyText,
		audienceSpec: c.audienceSpec ?? null,
	})
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Problems that block approval. Empty list means approvable. */
export function approvalBlockers(c: CreativeFields): string[] {
	const out: string[] = []
	if (!c.brandKey) out.push('brandKey is required (selects the Zeluto sender profile)')
	if (!c.subject) out.push('subject is required')
	if (!c.bodyText) out.push('bodyText is required')
	if (!c.audienceSpec) out.push('audienceSpec is required')
	const text = [c.subject, c.previewText, c.bodyHtml, c.bodyText].filter(Boolean).join('\n')
	for (const re of PLACEHOLDER_PATTERNS) {
		if (re.test(text)) out.push(`placeholder text found: ${re.source}`)
	}
	return out
}

function esc(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Creative-only preview for review inside Indices. The final per-recipient
 * preview (with sender profile, footer and headers) is rendered by Zeluto.
 */
export function renderCreativePreviewHtml(c: CreativeFields & { name: string; approvalStatus: string; contentHash: string | null }): string {
	const body = c.bodyHtml ?? `<pre style="white-space:pre-wrap;font:inherit">${esc(c.bodyText ?? '')}</pre>`
	const spec = (c.audienceSpec ?? {}) as { source?: string; recipients?: string[] }
	return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.name)} - preview</title>
<style>body{font:15px/1.5 system-ui,sans-serif;background:#f3f4f6;margin:0;padding:24px}.card{max-width:640px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:20px}.meta{color:#6b7280;font-size:13px;margin-bottom:12px}.badge{display:inline-block;padding:2px 8px;border-radius:999px;background:#e0e7ff;font-size:12px}</style></head><body>
<div class="card"><div class="meta"><span class="badge">${esc(c.approvalStatus)}</span> brand: ${esc(c.brandKey ?? 'none')} | audience: ${esc(spec.source ?? 'none')}${spec.recipients ? ` (${spec.recipients.length} recipients)` : ''}<br>hash: ${esc(c.contentHash ?? 'not computed')}</div>
<h2 style="margin:0 0 4px">${esc(c.subject ?? '(no subject)')}</h2><div class="meta">${esc(c.previewText ?? '')}</div><hr>${body}
<div class="meta" style="margin-top:20px">Footer, from, reply-to and unsubscribe are added by the Zeluto sender profile at send time.</div></div></body></html>`
}

export function isApprover(userId: string | undefined, allowlist: string | undefined): boolean {
	if (!userId || !allowlist) return false
	return allowlist.split(',').map((s) => s.trim()).filter(Boolean).includes(userId)
}

export function timingSafeEqual(a: string, b: string): boolean {
	const ea = new TextEncoder().encode(a)
	const eb = new TextEncoder().encode(b)
	let diff = ea.length ^ eb.length
	const n = Math.max(ea.length, eb.length)
	for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
	return diff === 0
}
