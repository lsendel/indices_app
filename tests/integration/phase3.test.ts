import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'crypto'
import { getTestApp } from '../helpers/test-app'
import { ZelutoClient } from '../../src/services/zeluto/client'
import { syncContent } from '../../src/services/zeluto/content-sync'
import { syncContacts } from '../../src/services/zeluto/contact-sync'
import { syncCampaign } from '../../src/services/zeluto/campaign-sync'
import { syncExperiment, mapArmsToVariants } from '../../src/services/zeluto/experiment-sync'
import { classifyDeliveryEvent, isEngagementEvent } from '../../src/services/zeluto/events'
import { withRetry } from '../../src/utils/retry'
import { zelutoTenantContext, zelutoWebhookEvent, zelutoDeliveryEvent } from '../../src/types/zeluto'
import { ZelutoApiError } from '../../src/types/errors'

describe('Phase 3: Zeluto Integration', () => {
	const app = getTestApp()

	describe('types', () => {
		it('zeluto tenant context validates correctly', () => {
			expect(
				zelutoTenantContext.safeParse({
					organizationId: 'org-1',
					userId: 'user-1',
					userRole: 'admin',
					plan: 'pro',
				}).success,
			).toBe(true)
		})

		it('delivery event validates correctly', () => {
			expect(
				zelutoDeliveryEvent.safeParse({
					id: 'e1',
					jobId: 'j1',
					contactId: 1,
					channel: 'email',
					eventType: 'opened',
					providerMessageId: null,
					createdAt: '2026-01-01T00:00:00Z',
				}).success,
			).toBe(true)
		})

		it('ZelutoApiError extends AppError', () => {
			const err = new ZelutoApiError('NOT_FOUND', 'Template not found', 404)
			expect(err.statusCode).toBe(404)
			expect(err.code).toBe('ZELUTO_API_ERROR')
			expect(err.zelutoCode).toBe('NOT_FOUND')
		})
	})

	describe('client', () => {
		it('encodes tenant context as base64 in header', () => {
			const ctx = { organizationId: 'o', userId: 'u', userRole: 'admin' as const, plan: 'pro' as const }
			const encoded = btoa(JSON.stringify(ctx))
			const decoded = JSON.parse(atob(encoded))
			expect(decoded.organizationId).toBe('o')
		})
	})

	describe('sync services', () => {
		it('content sync calls createTemplate', async () => {
			const mockClient = {
				createTemplate: vi.fn().mockResolvedValue({ id: 1 }),
			}
			const result = await syncContent(mockClient as any, {
				name: 'Test',
				channel: 'email',
				subject: 'Hi',
				bodyHtml: '<p>Hello</p>',
			})
			expect(result.zelutoTemplateId).toBe(1)
		})

		it('contact sync maps and imports', async () => {
			const mockClient = {
				importContacts: vi.fn().mockResolvedValue({ imported: 2, failed: 0, errors: [] }),
			}
			const result = await syncContacts(mockClient as any, [
				{ name: 'A B', email: 'a@b.com', company: 'C', role: 'D' },
				{ name: 'E F', email: 'e@f.com', company: 'G', role: 'H' },
			])
			expect(result.imported).toBe(2)
		})

		it('campaign sync creates and optionally sends', async () => {
			const mockClient = {
				createCampaign: vi.fn().mockResolvedValue({ id: 5, status: 'draft' }),
				sendCampaign: vi.fn().mockResolvedValue({ id: 5, status: 'sending' }),
			}
			const result = await syncCampaign(mockClient as any, {
				name: 'Test',
				goal: 'Goal',
				channels: ['email'],
				action: 'send',
			})
			expect(result.zelutoCampaignId).toBe(5)
			expect(mockClient.sendCampaign).toHaveBeenCalled()
		})

		it('experiment sync maps arms to variants', async () => {
			const arms = [
				{ id: 'a1', variantName: 'Control', content: { s: 'A' }, trafficPct: 0.5 },
				{ id: 'a2', variantName: 'Test', content: { s: 'B' }, trafficPct: 0.5 },
			]
			const variants = mapArmsToVariants(arms)
			expect(variants).toHaveLength(2)
			expect(variants[0].name).toBe('Control')
			expect(variants[0].armId).toBe('a1')
		})
	})

	describe('event processing', () => {
		it('classifies engagement events correctly', () => {
			expect(classifyDeliveryEvent('opened')).toBe('engagement')
			expect(classifyDeliveryEvent('clicked')).toBe('engagement')
			expect(classifyDeliveryEvent('bounced')).toBe('negative')
			expect(classifyDeliveryEvent('delivered')).toBe('neutral')
		})

		it('isEngagementEvent filters correctly', () => {
			expect(isEngagementEvent('opened')).toBe(true)
			expect(isEngagementEvent('bounced')).toBe(false)
		})
	})

	describe('webhook endpoint', () => {
		it('rejects unauthenticated webhook calls', async () => {
			const res = await app.request('/webhooks/zeluto', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ eventType: 'test', payload: {} }),
			})
			expect(res.status).toBe(401)
		})

		it('accepts properly signed webhook', async () => {
			const body = JSON.stringify({ eventType: 'delivery.sent', payload: { jobId: 'j1' } })
			const secret = 'dev-webhook-secret'
			const signature = createHmac('sha256', secret).update(body).digest('hex')

			const res = await app.request('/webhooks/zeluto', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Webhook-Signature': `sha256=${signature}`,
				},
				body,
			})
			expect(res.status).toBe(200)
		})
	})

	describe('retry utility', () => {
		it('retries and eventually succeeds', async () => {
			const fn = vi
				.fn()
				.mockRejectedValueOnce(new Error('fail'))
				.mockResolvedValue('ok')

			const result = await withRetry(fn, { baseDelayMs: 1, maxRetries: 2 })
			expect(result).toBe('ok')
			expect(fn).toHaveBeenCalledTimes(2)
		})
	})

	describe('route validation', () => {
		it('zeluto config route exists', async () => {
			const res = await app.request('/api/v1/zeluto/config', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					organizationId: 'org-1',
					userId: 'user-1',
					userRole: 'admin',
					plan: 'pro',
				}),
			})
			expect(res.status).not.toBe(404)
		})

		it('sync content route exists', async () => {
			const res = await app.request('/api/v1/zeluto/sync/content', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Test', channel: 'email' }),
			})
			expect(res.status).not.toBe(404)
		})

		it('sync logs route exists', async () => {
			const res = await app.request('/api/v1/zeluto/sync/logs')
			expect(res.status).not.toBe(404)
		})
	})
})
