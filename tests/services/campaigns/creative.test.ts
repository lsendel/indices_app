import { describe, it, expect } from 'vitest'
import {
	approvalBlockers,
	computeContentHash,
	isApprover,
	renderCreativePreviewHtml,
	timingSafeEqual,
} from '../../../src/services/campaigns/creative'

const base = {
	brandKey: 'families.care',
	subject: 'Quick note for your agency',
	previewText: null,
	bodyHtml: null,
	bodyText: 'Hello there',
	audienceSpec: { source: 'wave1', rules: {}, exclusions: ['suppression'] },
}

describe('campaign creative', () => {
	it('hash is stable across key order and changes with content', async () => {
		const a = await computeContentHash(base)
		const b = await computeContentHash({ ...base, audienceSpec: { exclusions: ['suppression'], rules: {}, source: 'wave1' } })
		const c = await computeContentHash({ ...base, subject: 'Different' })
		expect(a).toBe(b)
		expect(a).not.toBe(c)
		expect(a).toMatch(/^[0-9a-f]{64}$/)
	})

	it('blocks approval without brand, subject, body or audience', () => {
		const blockers = approvalBlockers({ ...base, brandKey: null, subject: null, bodyText: null, audienceSpec: null })
		expect(blockers).toHaveLength(4)
	})

	it('blocks approval while a postal-address placeholder is in the text', () => {
		const blockers = approvalBlockers({ ...base, bodyText: 'x\nfamilies.care, [POSTAL ADDRESS PENDING]' })
		expect(blockers.some((b) => b.startsWith('placeholder'))).toBe(true)
		expect(approvalBlockers(base)).toEqual([])
	})

	it('approver allowlist fails closed', () => {
		expect(isApprover('u1', undefined)).toBe(false)
		expect(isApprover(undefined, 'u1')).toBe(false)
		expect(isApprover('u2', 'u1, u3')).toBe(false)
		expect(isApprover('u3', 'u1, u3')).toBe(true)
	})

	it('timingSafeEqual compares correctly', () => {
		expect(timingSafeEqual('abc', 'abc')).toBe(true)
		expect(timingSafeEqual('abc', 'abd')).toBe(false)
		expect(timingSafeEqual('abc', 'abcd')).toBe(false)
	})

	it('preview escapes html in text and shows status', () => {
		const html = renderCreativePreviewHtml({
			...base,
			subject: '<script>x</script>',
			bodyText: '<b>hi</b>',
			name: 'N',
			approvalStatus: 'draft',
			contentHash: 'h',
		})
		expect(html).not.toContain('<script>x')
		expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;')
		expect(html).toContain('draft')
	})
})
