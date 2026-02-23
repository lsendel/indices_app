import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ZelutoClient } from '../../../src/services/zeluto/client'

describe('ZelutoClient', () => {
	const originalFetch = global.fetch

	beforeEach(() => {
		global.fetch = vi.fn()
	})

	afterEach(() => {
		global.fetch = originalFetch
	})

	function mockFetchOk(data: unknown) {
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: true,
			status: 200,
			json: () => Promise.resolve(data),
		})
	}

	function mockFetchError(status: number, data: unknown) {
		;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
			ok: false,
			status,
			json: () => Promise.resolve(data),
		})
	}

	const client = new ZelutoClient({
		baseUrl: 'https://zeluto.test/api/v1',
		tenantContext: {
			organizationId: 'org-1',
			userId: 'user-1',
			userRole: 'admin',
			plan: 'pro',
		},
	})

	describe('headers', () => {
		it('sends X-Tenant-Context header as base64 JSON', async () => {
			mockFetchOk({ id: 1, name: 'Test' })
			await client.createTemplate({ name: 'Test', type: 'email' })

			const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
			const header = opts.headers['X-Tenant-Context']
			const decoded = JSON.parse(atob(header))
			expect(decoded.organizationId).toBe('org-1')
			expect(decoded.userId).toBe('user-1')
			expect(decoded.userRole).toBe('admin')
			expect(decoded.plan).toBe('pro')
		})

		it('includes API key when provided', async () => {
			const clientWithKey = new ZelutoClient({
				baseUrl: 'https://zeluto.test/api/v1',
				tenantContext: { organizationId: 'o', userId: 'u', userRole: 'admin', plan: 'pro' },
				apiKey: 'sk-test-123',
			})
			mockFetchOk({ id: 1 })
			await clientWithKey.createTemplate({ name: 'T', type: 'email' })

			const [, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
			expect(opts.headers['X-API-Key']).toBe('sk-test-123')
		})
	})

	describe('createTemplate', () => {
		it('POSTs to /content/templates', async () => {
			mockFetchOk({ id: 42, name: 'Welcome', type: 'email' })
			const result = await client.createTemplate({ name: 'Welcome', type: 'email', subject: 'Hi' })

			expect(result.id).toBe(42)
			const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
			expect(url).toBe('https://zeluto.test/api/v1/content/templates')
			expect(opts.method).toBe('POST')
		})
	})

	describe('importContacts', () => {
		it('POSTs to /crm/contacts/import', async () => {
			mockFetchOk({ imported: 10, failed: 0, errors: [] })
			const result = await client.importContacts([{ email: 'a@b.com', firstName: 'A' }])

			expect(result.imported).toBe(10)
			const [url] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
			expect(url).toBe('https://zeluto.test/api/v1/crm/contacts/import')
		})
	})

	describe('createCampaign', () => {
		it('POSTs to /campaign/campaigns', async () => {
			mockFetchOk({ id: 5, name: 'Camp', status: 'draft' })
			const result = await client.createCampaign({ name: 'Camp', type: 'email' })

			expect(result.id).toBe(5)
		})
	})

	describe('getCampaignStats', () => {
		it('GETs campaign stats', async () => {
			mockFetchOk({ campaignId: 5, sent: 100, opened: 40 })
			const result = await client.getCampaignStats(5)
			expect(result.sent).toBe(100)
		})
	})

	describe('createAbTest', () => {
		it('POSTs to /campaign/ab-tests', async () => {
			mockFetchOk({ id: 3, campaignId: 5, status: 'running' })
			const result = await client.createAbTest({
				campaignId: 5,
				name: 'Test',
				variants: [{ a: 1 }],
				winningCriteria: 'clicks',
			})
			expect(result.id).toBe(3)
		})
	})

	describe('error handling', () => {
		it('throws ZelutoApiError on non-ok response', async () => {
			mockFetchError(404, { code: 'NOT_FOUND', message: 'Template not found' })

			await expect(client.createTemplate({ name: 'X', type: 'email' })).rejects.toThrow(
				'Template not found',
			)
		})
	})

	describe('registerWebhook', () => {
		it('POSTs to /integrations/webhooks', async () => {
			mockFetchOk({ id: 7, url: 'https://pi.indices.app/webhooks/zeluto', events: ['delivery.opened'] })
			const result = await client.registerWebhook({
				url: 'https://pi.indices.app/webhooks/zeluto',
				events: ['delivery.opened'],
				secret: 'sec',
			})
			expect(result.id).toBe(7)
		})
	})
})
