import { describe, it, expect } from 'vitest'
import {
	zelutoTenantContext,
	zelutoTemplateCreate,
	zelutoContactImportResult,
	zelutoDeliveryEvent,
	zelutoWebhookEvent,
	zelutoCampaignStats,
	zelutoAbTestCreate,
} from '../../src/types/zeluto'

describe('zeluto types', () => {
	describe('zelutoTenantContext', () => {
		it('parses valid context', () => {
			const result = zelutoTenantContext.safeParse({
				organizationId: '550e8400-e29b-41d4-a716-446655440000',
				userId: '550e8400-e29b-41d4-a716-446655440001',
				userRole: 'admin',
				plan: 'pro',
			})
			expect(result.success).toBe(true)
		})

		it('rejects missing fields', () => {
			expect(zelutoTenantContext.safeParse({}).success).toBe(false)
			expect(zelutoTenantContext.safeParse({ organizationId: 'x' }).success).toBe(false)
		})

		it('rejects invalid role', () => {
			const result = zelutoTenantContext.safeParse({
				organizationId: 'org-1',
				userId: 'user-1',
				userRole: 'superadmin',
				plan: 'pro',
			})
			expect(result.success).toBe(false)
		})
	})

	describe('zelutoTemplateCreate', () => {
		it('parses valid template', () => {
			const result = zelutoTemplateCreate.safeParse({
				name: 'Welcome Email',
				type: 'email',
				subject: 'Welcome!',
				bodyHtml: '<h1>Hello</h1>',
			})
			expect(result.success).toBe(true)
		})

		it('requires name and type', () => {
			expect(zelutoTemplateCreate.safeParse({}).success).toBe(false)
			expect(zelutoTemplateCreate.safeParse({ name: 'X' }).success).toBe(false)
		})
	})

	describe('zelutoContactImportResult', () => {
		it('parses import result with errors', () => {
			const result = zelutoContactImportResult.safeParse({
				imported: 95,
				failed: 5,
				errors: [{ index: 2, error: 'Invalid email' }],
			})
			expect(result.success).toBe(true)
			if (result.success) {
				expect(result.data.imported).toBe(95)
				expect(result.data.errors).toHaveLength(1)
			}
		})
	})

	describe('zelutoDeliveryEvent', () => {
		it('parses delivery event', () => {
			const result = zelutoDeliveryEvent.safeParse({
				id: 'evt-1',
				jobId: 'job-1',
				contactId: 42,
				channel: 'email',
				eventType: 'opened',
				providerMessageId: 'msg-123',
				createdAt: '2026-02-22T00:00:00Z',
			})
			expect(result.success).toBe(true)
		})

		it('rejects invalid event type', () => {
			const result = zelutoDeliveryEvent.safeParse({
				id: 'evt-1',
				jobId: 'job-1',
				contactId: 42,
				channel: 'email',
				eventType: 'invalid_type',
				providerMessageId: null,
				createdAt: '2026-02-22T00:00:00Z',
			})
			expect(result.success).toBe(false)
		})
	})

	describe('zelutoWebhookEvent', () => {
		it('parses webhook callback payload', () => {
			const result = zelutoWebhookEvent.safeParse({
				eventType: 'delivery.opened',
				payload: { jobId: 'job-1', contactId: 42 },
			})
			expect(result.success).toBe(true)
		})
	})

	describe('zelutoCampaignStats', () => {
		it('parses campaign stats', () => {
			const result = zelutoCampaignStats.safeParse({
				id: 1,
				campaignId: 10,
				totalRecipients: 1000,
				sent: 990,
				delivered: 980,
				opened: 400,
				clicked: 100,
				bounced: 10,
				complained: 2,
				unsubscribed: 5,
			})
			expect(result.success).toBe(true)
		})
	})

	describe('zelutoAbTestCreate', () => {
		it('parses A/B test create', () => {
			const result = zelutoAbTestCreate.safeParse({
				campaignId: 10,
				name: 'Subject line test',
				variants: [{ subject: 'A' }, { subject: 'B' }],
				winningCriteria: 'clicks',
			})
			expect(result.success).toBe(true)
		})
	})
})
